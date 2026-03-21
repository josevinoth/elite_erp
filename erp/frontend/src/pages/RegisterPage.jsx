import { useNavigate } from "react-router-dom";
import AuthForm from "../components/AuthForm";
import AuthLayout from "../components/AuthLayout";
import useAuthForm from "../hooks/useAuthForm";
import { registerUser } from "../services/authApi";

const registerFields = [
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
];

function RegisterPage() {
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
    { username: "", email: "", password1: "", password2: "" },
    registerUser,
    (_data, setValues) => {
      setValues({ username: "", email: "", password1: "", password2: "" });
      setTimeout(() => navigate("/login"), 700);
    }
  );

  return (
    <AuthLayout
      title="Create account"
      alternateText="Already have an account? Log in"
      alternateTo="/login"
    >
      {successMessage ? (
        <div className="auth-alert">{successMessage}</div>
      ) : null}
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
import AuthForm from "../components/AuthForm";
import AuthLayout from "../components/AuthLayout";
import useAuthForm from "../hooks/useAuthForm";
import { fetchRegisterMeta, registerUser } from "../services/authApi";

function RegisterPage() {
  const navigate = useNavigate();
  const [meta, setMeta] = useState({ role_options: [], status_options: [] });

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
        name: "role",
        label: "Role",
        icon: "role",
        type: "select",
        required: true,
        options: meta.role_options,
      },
      {
        name: "status",
        label: "Status",
        icon: "status",
        type: "select",
        required: true,
        options: meta.status_options,
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
    [meta.role_options, meta.status_options]
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
    { username: "", email: "", role: "", status: "", password1: "", password2: "" },
    registerUser,
    (_data, setValues) => {
      setValues({ username: "", email: "", role: "", status: "", password1: "", password2: "" });
      setTimeout(() => {
        navigate("/login");
      }, 700);
    }
  );

  useEffect(() => {
    let mounted = true;
    fetchRegisterMeta()
      .then((data) => {
        if (!mounted) {
          return;
        }
        setMeta({
          role_options: Array.isArray(data.role_options) ? data.role_options : [],
          status_options: Array.isArray(data.status_options) ? data.status_options : [],
        });
      })
      .catch(() => {
        if (!mounted) {
          return;
        }
        setMeta({ role_options: ["User"], status_options: ["New Registration", "Active", "Inactive"] });
      });

    return () => {
      mounted = false;
    };
  }, []);

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

