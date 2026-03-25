import { useState } from "react";

function normalizeErrors(payload = {}) {
  const backendErrors = payload.errors || {};
  const fieldErrors = {};

  Object.keys(backendErrors).forEach((key) => {
    if (key === "__all__") {
      return;
    }

    const value = backendErrors[key];
    fieldErrors[key] = Array.isArray(value) ? value[0] : String(value);
  });

  const nonField = backendErrors.__all__;
  const formError = Array.isArray(nonField) ? nonField[0] : payload.message || "";

  return { fieldErrors, formError };
}

export default function useAuthForm(initialValues, submitHandler, onSuccess) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
    setFormError("");
    setSuccessMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const submittedValues = { ...values };
    setLoading(true);
    setErrors({});
    setFormError("");
    setSuccessMessage("");

    try {
      const data = await submitHandler(submittedValues);
      setSuccessMessage(data.message || "Request completed.");

      if (onSuccess) {
        onSuccess(data, setValues, submittedValues);
      }
    } catch (error) {
      const { fieldErrors, formError: normalized } = normalizeErrors(error.payload || {});
      setErrors(fieldErrors);
      setFormError(normalized || error.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return {
    values,
    errors,
    formError,
    successMessage,
    loading,
    handleChange,
    handleSubmit,
  };
}

