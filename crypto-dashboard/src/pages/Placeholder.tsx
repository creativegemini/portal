import { EmptyState, Panel } from "../components/primitives";

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
        </div>
      </div>
      <Panel>
        <EmptyState
          message={`${title} isn't designed yet — it's next, after the Overview and Strategies review.`}
          action={
            <a className="btn btn-ghost btn-sm" href="#/overview">
              Back to Overview
            </a>
          }
        />
      </Panel>
    </>
  );
}
