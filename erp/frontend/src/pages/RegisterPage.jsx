import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthForm from "../components/AuthForm";
import AuthLayout from "../components/AuthLayout";
import useAuthForm from "../hooks/useAuthForm";
import { fetchRegisterMeta, registerUser } from "../services/authApi";

function RegisterPage() {
  const navigate = useNavigate();
  const [teamOptions, setTeamOptions] = useState([]);

  useEffect(() => {
    let mounted = true;
    fetchRegisterMeta()
      .then((data) => {
        if (!mounted) return;
        setTeamOptions(
          Array.isArray(data.team_options) ? data.team_options : ["CDC Team", "Oman Team"]
        );
      })
      .catch(() => {
        if (!mounted) return;
        setTeamOptions(["CDC Team", "Oman Team"]);
      });
    return () => { mounted = false; };
  }, []);

  const registerFields = useMemo(
    () => [
      {
        name: "username",
        label: "Username",
        icon: "user",
        type: "text",
        autoComplete: "username",
        required: true,
      },
      {
        name: "email",
        label: "Email",
        type: "email",
        autoComplete: "email",
        required: true,
      },
      {
        name: "team",
        label: "Team",
        icon: "team",
        type: "select",
        required: true,
        options: teamOptions,
      },
      {
        name: "role",
        label: "Role",
        icon: "role",
        type: "select",
        required: true,
        disabled: true,
        options: ["User"],
      },
      {
        name: "status",
        label: "Status",
        icon: "status",
        type: "select",
        required: true,
        disabled: true,
        options: ["New Registration"],
      },
      {
        name: "password1",
        label: "Password",
        icon: "lock",
        type: "password",
        autoComplete: "new-password",
        required: true,
      },
      {
        name: "password2",
        label: "Confirm password",
        icon: "lock",
        type: "password",
        autoComplete: "new-password",
        required: true,
      },
    ],
    [teamOptions]
  );

  const {
    values,
    errors,
    formError,
    successMessage,
    loading,
    handleChange,
    handleSubmit,
  } = useAuthForm(
    {
      username: "",
      email: "",
      team: "",
      role: "User",
      status: "New Registration",
      password1: "",
      password2: "",
    },
    registerUser,
    (_data, setValues) => {
      setValues({
        username: "",
        email: "",
        team: "",
        role: "User",
        status: "New Registration",
        password1: "",
        password2: "",
      });
      setTimeout(() => {
        navigate("/login", {
          state: { approvalMessage: "Approval pending. Contact administrator..." },
        });
      }, 700);
    }
  );

  return (
    <AuthLayout
      title="Create account"
      alternateText="Already have an account? Log in"
      alternateTo="/login"
    >
      {successMessage ? <div className="auth-alert">{successMessage}</div> : null}
      <AuthForm
        fields={registerFields}
        submitLabel="Register"
        values={values}
        errors={errors}
        formError={formError}
        loading={loading}
        onChange={handleChange}
        onSubmit={handleSubmit}
      />
    </AuthLayout>
  );
}

export default RegisterPage;

