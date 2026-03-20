export default function OracleRiderStatsExtensionPrivacyPage() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold text-gray-900">
          Privacy Policy for Oracle Rider Stats (Chrome Extension)
        </h1>
        <p className="mt-2 text-sm text-gray-600">Effective date: March 8, 2026</p>

        <div className="mt-8 space-y-6 rounded-xl border border-gray-200 bg-white p-6 text-gray-800 shadow-sm">
          <section>
            <h2 className="text-xl font-semibold text-gray-900">1. Who we are</h2>
            <p className="mt-2">
              This policy applies to the Chrome extension <strong>Oracle Rider Stats</strong> published by Oracle
              Games.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">2. What data the extension processes</h2>
            <p className="mt-2">The extension processes only the minimum data needed to show rider statistics:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Rider name and/or rider slug from the Oracle Games page where the user clicks.</li>
              <li>Public rider profile data fetched from ProCyclingStats.</li>
            </ul>
            <p className="mt-2">
              The extension does <strong>not</strong> collect passwords, payment information, or sensitive personal
              user data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">3. Permissions and external requests</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <code>https://www.procyclingstats.com/*</code> host permission is used to retrieve rider statistics
                after a user action.
              </li>
              <li>The extension does not load remote executable code (no remote JS/CSS execution).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">4. How data is used</h2>
            <p className="mt-2">
              Data is used only to display rider information in the extension panel on Oracle Games pages. Data is not
              used for advertising, profiling, or data brokerage.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">5. Data sharing and selling</h2>
            <p className="mt-2">
              We do not sell personal data. We do not share extension-processed data with third parties except for the
              direct request to ProCyclingStats needed to fetch public rider profile information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">6. Data retention</h2>
            <p className="mt-2">
              The extension does not maintain a server-side user database for this feature and does not intentionally
              retain personal data from extension usage.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">7. Contact</h2>
            <p className="mt-2">
              For privacy questions, contact:{" "}
              <a className="text-primary underline" href="mailto:no-reply@send.oracle-games.online">
                no-reply@send.oracle-games.online
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900">8. Changes to this policy</h2>
            <p className="mt-2">
              We may update this policy when product behavior or legal requirements change. The latest version will
              always be available at this URL.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
