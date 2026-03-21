import { useNavigate } from "react-router-dom";
import AuthForm from "../components/AuthForm";
import AuthLayout from "../components/AuthLayout";
import useAuthForm from "../hooks/useAuthForm";
import { loginUser } from "../services/authApi";
import { setSessionUser } from "../services/sessionUser";

const loginFields = [
  {
    name: "username",
    label: "Username",
    icon: "user",
    type: "text",
    autoComplete: "username",
    required: true,
  },
  {
    name: "password",
    label: "Password",
    icon: "lock",
    type: "password",
    autoComplete: "current-password",
    required: true,
  },
];

function LoginPage({ onLoginSuccess }) {
  const navigate = useNavigate();
  const {
    values,
    errors,
    formError,
    successMessage,
    loading,
    handleChange,
    handleSubmit,
  } = useAuthForm(
    { username: "", password: "" },
    loginUser,
    (data, _setValues, submittedValues) => {
      const resolvedUser = {
        username: data?.user?.username || submittedValues.username || "Guest",
        role: data?.user?.role || "User",
      };

      setSessionUser(resolvedUser);

      if (onLoginSuccess) {
        onLoginSuccess(resolvedUser);
      }

      setTimeout(() => {
        navigate("/home", { replace: true });
      }, 400);
    }
  );

  return (
    <AuthLayout
      title="Login Into Your Account"
      alternateText="Need an account? Register"
      alternateTo="/register"
    >
      {successMessage ? <div className="auth-alert">{successMessage}</div> : null}
      <AuthForm
        fields={loginFields}
        submitLabel="Log in"
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

export default LoginPage;

