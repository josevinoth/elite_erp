function ModulePage({ title, description }) {
  return (
    <section className="module-page">
      <h1 className="module-page__title module-page__title--default">{title}</h1>
      <p className="module-page__description">{description}</p>
    </section>
  );
}

export default ModulePage;

