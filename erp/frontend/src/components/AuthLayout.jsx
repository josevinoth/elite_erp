import { Link } from "react-router-dom";

function AuthLayout({ title, alternateText, alternateTo, children }) {
  return (
    <main className="auth-layout">
      <section className="auth-card">
        <h1>{title}</h1>
        {children}
        <p className="alt-link">
          <Link to={alternateTo}>{alternateText}</Link>
        </p>
      </section>
    </main>
  );
}

export default AuthLayout;

