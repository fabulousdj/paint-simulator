import { roomSamples } from "../fixtures/roomSamples";

export function FixturePanel() {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Dev samples</h2>
      <p className="mt-1 text-xs text-gray-500">
        Representative fixture metadata for later visual validation.
      </p>
      <div className="mt-3 space-y-3">
        {roomSamples.map((sample) => (
          <article key={sample.id} className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-medium text-gray-900">{sample.name}</h3>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                {sample.lightingCategory.replace("-", " ")}
              </span>
            </div>
            <p className="mt-2 text-xs font-medium text-amber-700">Metadata placeholder</p>
            <p className="mt-1 text-xs text-gray-600">{sample.usageNotes}</p>
            <p className="mt-1 text-xs text-gray-500">{sample.licenseNotes}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
