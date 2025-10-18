import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="page page--not-found">
      <h1>Page not found</h1>
      <p>The resource you are looking for does not exist. It may have moved or been archived.</p>
      <Link className="button button--primary" to="/">
        Back to overview
      </Link>
    </div>
  );
}

export default NotFoundPage;
