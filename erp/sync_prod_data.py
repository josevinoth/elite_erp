"""
Synchronize data from the restored prod backup database (`erp_prod_temp`)
into local development database (`erp_002`) for:
  - public.erp_app_project
  - public.erp_app_cdcteamexpense
  - public.erp_app_task
  - public.erp_app_timesheet
and all their connecting / dependency tables:
  - public.auth_user & erp_app_userprofile
  - public.erp_app_projectstatusoption
  - public.erp_app_activity
  - public.erp_app_expenseitem
  - public.erp_app_expensesession
  - public.erp_app_expensestatusoption
  - public.erp_app_taskstatusoption
  - public.erp_app_tasknotificationread
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASS = os.getenv("DB_PASSWORD", "244613")

SRC_DB = "erp_prod_temp"
DST_DB = os.getenv("DB_NAME", "erp_002")


def get_connection(dbname):
    return psycopg2.connect(
        dbname=dbname,
        user=DB_USER,
        password=DB_PASS,
        host=DB_HOST,
        port=DB_PORT,
    )


def reset_sequence(cur, table_name):
    try:
        cur.execute("SELECT pg_get_serial_sequence(%s, %s);", (f"public.{table_name}", "id"))
        seq = cur.fetchone()[0]
        if seq:
            cur.execute(f"SELECT setval('{seq}', COALESCE((SELECT MAX(id) FROM public.\"{table_name}\"), 1));")
    except Exception as e:
        print(f"Warning resetting sequence for {table_name}: {e}")


def copy_table_replace(src_cur, dst_cur, table_name):
    """
    For lookup tables where IDs must match PROD exactly (like expense items/sessions).
    """
    dst_cur.execute(
        """
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = %s
        ORDER BY ordinal_position;
    """,
        (table_name,),
    )
    dst_cols = [r[0] for r in dst_cur.fetchall()]

    src_cur.execute(
        """
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = %s
        ORDER BY ordinal_position;
    """,
        (table_name,),
    )
    src_cols = [r["column_name"] for r in src_cur.fetchall()]

    common_cols = [c for c in dst_cols if c in src_cols]
    col_str = ", ".join(f'"{c}"' for c in common_cols)

    src_cur.execute(f'SELECT {col_str} FROM public."{table_name}" ORDER BY id;')
    rows = src_cur.fetchall()

    # Truncate and re-insert
    dst_cur.execute(f'TRUNCATE TABLE public."{table_name}" CASCADE;')
    if rows:
        data_tuples = [tuple(row[c] for c in common_cols) for row in rows]
        insert_sql = f'INSERT INTO public."{table_name}" ({col_str}) VALUES ({", ".join(["%s"] * len(common_cols))});'
        psycopg2.extras.execute_batch(dst_cur, insert_sql, data_tuples, page_size=200)

    reset_sequence(dst_cur, table_name)
    print(f"[{table_name}] Replaced with {len(rows)} rows from PROD.")


def upsert_table(src_cur, dst_cur, table_name, conflict_cols=["id"]):
    dst_cur.execute(
        """
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = %s
        ORDER BY ordinal_position;
    """,
        (table_name,),
    )
    dst_cols = [r[0] for r in dst_cur.fetchall()]

    src_cur.execute(
        """
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = %s
        ORDER BY ordinal_position;
    """,
        (table_name,),
    )
    src_cols = [r["column_name"] for r in src_cur.fetchall()]

    common_cols = [c for c in dst_cols if c in src_cols]
    col_str = ", ".join(f'"{c}"' for c in common_cols)

    src_cur.execute(f'SELECT {col_str} FROM public."{table_name}" ORDER BY {", ".join(conflict_cols)};')
    rows = src_cur.fetchall()

    if not rows:
        print(f"[{table_name}] 0 rows in source.")
        return

    update_cols = [c for c in common_cols if c not in conflict_cols]
    conflict_str = ", ".join(f'"{c}"' for c in conflict_cols)

    if update_cols:
        update_str = ", ".join(f'"{c}" = EXCLUDED."{c}"' for c in update_cols)
        on_conflict = f"ON CONFLICT ({conflict_str}) DO UPDATE SET {update_str}"
    else:
        on_conflict = f"ON CONFLICT ({conflict_str}) DO NOTHING"

    insert_sql = f'INSERT INTO public."{table_name}" ({col_str}) VALUES ({", ".join(["%s"] * len(common_cols))}) {on_conflict};'
    data_tuples = [tuple(row[c] for c in common_cols) for row in rows]
    psycopg2.extras.execute_batch(dst_cur, insert_sql, data_tuples, page_size=200)
    reset_sequence(dst_cur, table_name)
    print(f"[{table_name}] Upserted {len(rows)} rows from PROD.")


def main():
    print(f"Opening connections to SRC: {SRC_DB} and DST: {DST_DB}...")
    src_conn = get_connection(SRC_DB)
    dst_conn = get_connection(DST_DB)

    src_cur = src_conn.cursor(cursor_factory=RealDictCursor)
    dst_cur = dst_conn.cursor()

    try:
        # 1. Resolve local dev mock user conflicts in auth_user
        print("\n--- Step 1: Aligning auth_user ---")
        # In DEV, check if usernames collide with different IDs
        src_cur.execute("SELECT id, username FROM auth_user;")
        prod_users = {r["username"]: r["id"] for r in src_cur.fetchall()}

        dst_cur.execute("SELECT id, username FROM auth_user;")
        dev_users = {r[1]: r[0] for r in dst_cur.fetchall()}

        for uname, p_id in prod_users.items():
            if uname in dev_users and dev_users[uname] != p_id:
                old_dev_id = dev_users[uname]
                temp_uname = f"{uname}_dev_old_{old_dev_id}"
                print(f"Renaming dev user {uname} (id {old_dev_id}) -> {temp_uname} to allow prod user id {p_id}...")
                dst_cur.execute("UPDATE auth_user SET username = %s WHERE id = %s;", (temp_uname, old_dev_id))

        # Upsert auth_user from PROD
        upsert_table(src_cur, dst_cur, "auth_user", conflict_cols=["id"])

        # Upsert user profiles & teams
        upsert_table(src_cur, dst_cur, "erp_app_team", conflict_cols=["id"])
        upsert_table(src_cur, dst_cur, "erp_app_userstatusoption", conflict_cols=["id"])
        upsert_table(src_cur, dst_cur, "erp_app_userprofile", conflict_cols=["id"])
        upsert_table(src_cur, dst_cur, "auth_group", conflict_cols=["id"])
        copy_table_replace(src_cur, dst_cur, "auth_user_groups")

        # 2. Lookup tables for Project & Task & Expense
        print("\n--- Step 2: Synchronizing Lookup / Option Tables ---")
        for lookup in [
            "erp_app_projectstatusoption",
            "erp_app_activity",
            "erp_app_taskstatusoption",
            "erp_app_expensestatusoption",
            "erp_app_yesno_info",
            "erp_app_nonmoeproductseries_info",
            "erp_app_nonstandardlab_info",
            "erp_app_projectcategory_info",
            "erp_app_projectsubcategory_info",
            "erp_app_standardlab_info",
        ]:
            upsert_table(src_cur, dst_cur, lookup, conflict_cols=["id"])

        # For expense items & sessions:
        # First truncate cdcteamexpense so nothing references expenseitem or expensesession
        dst_cur.execute('TRUNCATE TABLE public."erp_app_cdcteamexpense" CASCADE;')
        copy_table_replace(src_cur, dst_cur, "erp_app_expenseitem")
        copy_table_replace(src_cur, dst_cur, "erp_app_expensesession")

        # 3. Core tables: erp_app_project
        print("\n--- Step 3: Synchronizing Projects (erp_app_project) ---")
        # Ensure erp_app_project columns allow NULL to match PROD
        nullable_columns = [
            "updated_by_id", "mas_approved_id", "advance_payment_received_id", 
            "prev_proj_replica_id", "prod_dwg_issued_id", "prod_dwg_issued_sf_id", 
            "non_moe_product_series_id", "non_standard_lab_id", "project_category_id", 
            "project_sub_category_id", "standard_lab_id"
        ]
        for col in nullable_columns:
            dst_cur.execute(f'ALTER TABLE public."erp_app_project" ALTER COLUMN "{col}" DROP NOT NULL;')

        upsert_table(src_cur, dst_cur, "erp_app_project", conflict_cols=["id"])

        # 4. Core tables: erp_app_cdcteamexpense
        print("\n--- Step 4: Synchronizing CDC Team Expenses (erp_app_cdcteamexpense) ---")
        copy_table_replace(src_cur, dst_cur, "erp_app_cdcteamexpense")

        # 5. Core tables: erp_app_task & notifications & timesheets
        print("\n--- Step 5: Synchronizing Tasks, Notifications & Timesheets ---")
        # First truncate downstream tables referencing erp_app_task
        dst_cur.execute('TRUNCATE TABLE public."erp_app_tasknotificationread" CASCADE;')
        dst_cur.execute('TRUNCATE TABLE public."erp_app_timesheet" CASCADE;')

        upsert_table(src_cur, dst_cur, "erp_app_task", conflict_cols=["id"])
        copy_table_replace(src_cur, dst_cur, "erp_app_tasknotificationread")
        copy_table_replace(src_cur, dst_cur, "erp_app_timesheet")

        # Commit all changes
        dst_conn.commit()
        print("\n>>> ALL TABLES SYNCHRONIZED AND COMMITTED SUCCESSFULLY! <<<")

    except Exception as e:
        dst_conn.rollback()
        print(f"\n[ERROR] Sync failed: {e}")
        raise
    finally:
        src_conn.close()
        dst_conn.close()


if __name__ == "__main__":
    main()
