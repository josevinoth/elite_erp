import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { resetPassword } from "../services/authApi";

function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const uid = useMemo(() => params.get("uid") || "", [params]);
  const token = useMemo(() => params.get("token") || "", [params]);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!uid || !token) {
      setError("Invalid reset link.");
      return;
    }

    if (!newPassword || !confirmPassword) {
      setError("Both password fields are required.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const data = await resetPassword({
        uid,
        token,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setSuccess(data.message || "Password reset successful.");
      setTimeout(() => navigate("/login", { replace: true }), 900);
    } catch (err) {
      setError(err.message || "Unable to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset Your Password"
      alternateText="Back to Login"
      alternateTo="/login"
    >
      {success ? <div className="auth-alert">{success}</div> : null}
      {error ? <div className="field-error">{error}</div> : null}

      <form className="auth-form" onSubmit={onSubmit}>
        <div className="form-row">
          <label htmlFor="new-password">New Password</label>
          <input
            id="new-password"
            type="password"
            className="auth-input"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
        </div>

        <div className="form-row">
          <label htmlFor="confirm-password">Confirm Password</label>
          <input
            id="confirm-password"
            type="password"
            className="auth-input"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        <button className="auth-button" type="submit" disabled={loading}>
          {loading ? "Please wait..." : "Reset Password"}
        </button>
      </form>
    </AuthLayout>
  );
}

export default ResetPasswordPage;

