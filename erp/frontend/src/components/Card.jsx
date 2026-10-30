export function Card({ className = "", children, ...props }) {
  return (
    <div className={`card ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children, ...props }) {
  return (
    <div className={`card-header ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function CardBody({ className = "", children, ...props }) {
  return (
    <div className={`card-body ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export default Card;
