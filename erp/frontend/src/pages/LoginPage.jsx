import { useNavigate } from "react-router-dom";
import AuthForm from "../components/AuthForm";
import AuthLayout from "../components/AuthLayout";
import useAuthForm from "../hooks/useAuthForm";
import { forgotPasswordRequest, loginUser } from "../services/authApi";
import { setSessionUser } from "../services/sessionUser";
import { useState } from "react";

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
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");

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
        id: data?.user?.id || submittedValues.username || "",
        username: data?.user?.username || submittedValues.username || "Guest",
        role: data?.user?.role || "User",
        team: data?.user?.team || "",
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

  const onForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotError("");
    setForgotSuccess("");

    const email = String(forgotEmail || "").trim();
    if (!email) {
      setForgotError("Registered email is required.");
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      setForgotError("Please enter a valid email address.");
      return;
    }

    setForgotLoading(true);
    try {
      const data = await forgotPasswordRequest({ email });
      setForgotSuccess(data.message || "Reset link sent to your registered email.");
      setForgotEmail("");
    } catch (err) {
      setForgotError(err.message || "Unable to process forgot password request.");
    } finally {
      setForgotLoading(false);
    }
  };

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

      <div className="auth-forgot-wrap">
        <button
          type="button"
          className="auth-forgot-toggle"
          onClick={() => {
            setShowForgot((v) => !v);
            setForgotError("");
            setForgotSuccess("");
          }}
        >
          Forgot Password?
        </button>

        {showForgot ? (
          <form className="auth-forgot-form" onSubmit={onForgotSubmit}>
            <label htmlFor="forgot-email">Registered Email</label>
            <input
              id="forgot-email"
              type="email"
              className="auth-input"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="Enter your registered email"
              required
            />
            {forgotError ? <small className="field-error">{forgotError}</small> : null}
            {forgotSuccess ? <small className="auth-forgot-success">{forgotSuccess}</small> : null}
            <button type="submit" className="auth-button" disabled={forgotLoading}>
              {forgotLoading ? "Validating..." : "Send Reset Link"}
            </button>
          </form>
        ) : null}
      </div>
    </AuthLayout>
  );
}

export default LoginPage;

