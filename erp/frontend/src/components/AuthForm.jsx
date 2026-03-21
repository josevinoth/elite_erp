import { LockIcon, RoleIcon, StatusIcon, TeamIcon, UserIcon } from "./AppIcons";

function renderFieldIcon(icon) {
  if (icon === "user") {
    return <UserIcon className="auth-field-icon" />;
  }

  if (icon === "lock") {
    return <LockIcon className="auth-field-icon" />;
  }

  if (icon === "role") {
    return <RoleIcon className="auth-field-icon" />;
  }

  if (icon === "status") {
    return <StatusIcon className="auth-field-icon" />;
  }

  if (icon === "team") {
    return <TeamIcon className="auth-field-icon" />;
  }

  return null;
}

function AuthForm({
  fields,
  submitLabel,
  values,
  errors,
  formError,
  loading,
  onChange,
  onSubmit,
}) {
  const renderControl = (field) => {
    if (field.type === "select") {
      return (
        <select
          id={field.name}
          name={field.name}
          value={values[field.name] || ""}
          className="auth-input"
          autoComplete={field.autoComplete}
          onChange={onChange}
          disabled={field.disabled}
          required={field.required}
        >
          <option value="">{field.placeholder || `Select ${field.label}`}</option>
          {(field.options || []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        id={field.name}
        name={field.name}
        type={field.type}
        value={values[field.name] || ""}
        className="auth-input"
        autoComplete={field.autoComplete}
        onChange={onChange}
        disabled={field.disabled}
        required={field.required}
      />
    );
  };

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      {formError ? <div className="field-error">{formError}</div> : null}

      {fields.map((field) => (
        <div className="form-row" key={field.name}>
          <label htmlFor={field.name}>{field.label}</label>
          <div className="auth-input-wrap">
            {renderFieldIcon(field.icon)}
            {renderControl(field)}
          </div>
          {errors[field.name] ? (
            <small className="field-error">{errors[field.name]}</small>
          ) : null}
        </div>
      ))}

      <button className="auth-button" type="submit" disabled={loading}>
        {loading ? "Please wait..." : submitLabel}
      </button>
    </form>
  );
}

export default AuthForm;

