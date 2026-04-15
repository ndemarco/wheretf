import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tour · WhereTF",
};

export default function TourPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-12">
        {/* Goal */}
        <section>
          <h1 className="text-2xl font-semibold text-slate-100 mb-3">
            Tour
          </h1>
          <p className="text-lg text-slate-200 leading-snug">
            WhereTF remembers where you put everything in your workshop so
            you don&apos;t have to.
          </p>
          <p className="text-sm text-slate-400 mt-3 leading-relaxed">
            You tell it where your storage is, what kind of layout each
            piece has, and what you put in each slot. Later, it tells you
            back.
          </p>
        </section>

        {/* Diagram */}
        <section>
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
            How it fits together
          </h2>
          <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-6">
            <ConceptDiagram />
          </div>
          <p className="text-xs text-slate-500 mt-3 leading-relaxed">
            A <b className="text-slate-300">module</b> has{" "}
            <b className="text-slate-300">levels</b>. A level that accepts
            an organizer (called a <b className="text-slate-300">receptacle</b>)
            can hold an <b className="text-slate-300">insert</b>. An insert
            was built from a <b className="text-slate-300">template</b> and
            contains <b className="text-slate-300">cells</b>. Each cell
            holds one or more <b className="text-slate-300">items</b> via
            an <b className="text-slate-300">assignment</b>.
          </p>
        </section>

        {/* Nouns */}
        <section>
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
            Concepts
          </h2>
          <dl className="space-y-4">
            <Concept term="Module">
              A top-level physical unit you own — a cabinet, a drawer
              chest, a shelving unit. Modules don&apos;t move often.{" "}
              <span className="text-slate-500">
                Example: MUSE (a red cabinet with 11 shelf levels).
              </span>
            </Concept>
            <Concept term="Level">
              One addressable slot inside a module — a shelf, a drawer, a
              bay. Each level is either a{" "}
              <em>receptacle</em> (accepts inserts) or <em>fixed</em>
              {" "}(built-in internal layout).{" "}
              <span className="text-slate-500">
                Example: MUSE 3 = the third shelf.
              </span>
            </Concept>
            <Concept term="Insert">
              A movable organizer that slots into a receptacle: a Plano
              tackle box, a Gridfinity bin, a drawer divider tray. Each
              insert is a <em>specific physical object</em> — your two
              Plano 3600s are two inserts, not one.{" "}
              <span className="text-slate-500">
                Example: &quot;construction screws&quot; (a Plano 3600
                currently on MUSE 3).
              </span>
            </Concept>
            <Concept term="Cell">
              The smallest addressable slot. Lives inside an insert, or
              directly inside a fixed level.{" "}
              <span className="text-slate-500">
                Example: A3 inside a Plano (row A, column 3).
              </span>
            </Concept>
            <Concept term="Template">
              The design/blueprint an insert or fixed level is built from.
              A Plano 3600 template defines a 4×6 compartment layout; any
              number of inserts can share that template.{" "}
              <span className="text-slate-500">
                Templates stay pristine; your inserts carry their own
                overrides (e.g. a merged cell).
              </span>
            </Concept>
            <Concept term="Item">
              Something you want to find later — an M3 cap screw, a 10kΩ
              resistor, a tube of CA glue. Items exist independently of
              where they&apos;re stored.
            </Concept>
            <Concept term="Assignment">
              The &quot;this item is here&quot; relationship. An item
              assigned to cell A3 of Plano #2 = &quot;I can find it
              there.&quot;
            </Concept>
            <Concept term="Interface type">
              The physical fit contract between an insert and a receptacle.{" "}
              <span className="text-slate-500">
                Example: MUSE&apos;s shelves accept any insert that
                provides the <code>plano-3600</code> interface.
              </span>
            </Concept>
          </dl>
        </section>

        {/* Verbs */}
        <section>
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
            What you do
          </h2>
          <dl className="space-y-3 text-sm">
            <Verb name="Create a module">
              Rare, admin action. You&apos;re telling the system about a
              new physical thing you own.
            </Verb>
            <Verb name="Place an insert">
              Drop a physical organizer into a receptacle level. You&apos;ll
              usually pick from compatible inserts already in the system.
            </Verb>
            <Verb name="Assign an item">
              The everyday action. Pick a cell and tell it what&apos;s
              stored there.
            </Verb>
            <Verb name="Move an insert">
              Pick the insert up, drop it into another receptacle. The
              cells (and whatever&apos;s assigned to them) ride along.
            </Verb>
            <Verb name="Merge / Divide / Disable / Restrict">
              Overrides on a specific cell. Merge two compartments
              together, subdivide one into front/rear, mark one as
              cracked/unavailable, clamp its usable size.
            </Verb>
          </dl>
        </section>

        {/* Workflow */}
        <section>
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
            Getting started
          </h2>
          <ol className="space-y-3 text-sm text-slate-300 list-decimal pl-5">
            <li>
              Create a module under{" "}
              <Link
                href="/modules/new"
                className="text-accent hover:brightness-110"
              >
                Admin → New Module
              </Link>
              . Give each level a type (receptacle / fixed) and, for
              receptacles, the interface type they accept.
            </li>
            <li>
              Open the module in{" "}
              <Link
                href="/modules"
                className="text-accent hover:brightness-110"
              >
                Modules
              </Link>
              . Pick a level. From the right-pane Place tab, pick a
              compatible insert or create one from a template.
            </li>
            <li>
              Click a cell in the grid. In the right pane, search for an
              item and assign it.
            </li>
            <li>
              When you need to find something later, come back and look
              at the grid — or use search once that lands.
            </li>
          </ol>
        </section>

        <section className="pt-6 border-t border-slate-700 text-xs text-slate-500">
          <p>
            This page is always reachable from the sidebar. The spec lives
            under{" "}
            <code className="text-slate-400">specification/</code> in the
            repo.
          </p>
        </section>
      </div>
    </div>
  );
}

function Concept({
  term,
  children,
}: {
  term: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-sm font-medium text-slate-100">{term}</dt>
      <dd className="text-sm text-slate-300 leading-relaxed mt-1">
        {children}
      </dd>
    </div>
  );
}

function Verb({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-4">
      <dt className="text-slate-100 font-medium">{name}</dt>
      <dd className="text-slate-300 leading-relaxed">{children}</dd>
    </div>
  );
}

/**
 * Hand-drawn SVG of the entity hierarchy. Two columns:
 * left shows physical containment (Module → Level → Insert → Cell),
 * right shows Items + Templates joining in via Assignment and
 * Template-of relationships.
 */
function ConceptDiagram() {
  const boxStyle = {
    fill: "rgba(30,41,59,0.7)",
    stroke: "#475569",
    strokeWidth: 1,
    rx: 6,
  };
  const textStyle = {
    fill: "#e2e8f0",
    fontSize: 13,
    fontFamily: "inherit",
    fontWeight: 500,
    textAnchor: "middle" as const,
    dominantBaseline: "central" as const,
  };
  const subStyle = {
    fill: "#94a3b8",
    fontSize: 10,
    fontFamily: "inherit",
    textAnchor: "middle" as const,
  };
  const labelStyle = {
    fill: "#64748b",
    fontSize: 10,
    fontFamily: "inherit",
    textAnchor: "middle" as const,
  };
  const arrow = "#64748b";

  return (
    <svg
      viewBox="0 0 640 320"
      className="w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <marker
          id="arrowhead"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={arrow} />
        </marker>
      </defs>

      {/* Column: Module → Level → Insert → Cell */}
      <rect x={20} y={20} width={180} height={40} {...boxStyle} />
      <text x={110} y={40} {...textStyle}>
        Module
      </text>
      <text x={110} y={56} {...subStyle}>
        MUSE, ALEX, BENCH
      </text>

      <line
        x1={110}
        y1={60}
        x2={110}
        y2={90}
        stroke={arrow}
        markerEnd="url(#arrowhead)"
      />
      <text x={145} y={78} {...labelStyle} textAnchor="start">
        has many
      </text>

      <rect x={20} y={90} width={180} height={40} {...boxStyle} />
      <text x={110} y={110} {...textStyle}>
        Level
      </text>
      <text x={110} y={126} {...subStyle}>
        receptacle / fixed
      </text>

      <line
        x1={110}
        y1={130}
        x2={110}
        y2={160}
        stroke={arrow}
        markerEnd="url(#arrowhead)"
      />
      <text x={145} y={148} {...labelStyle} textAnchor="start">
        holds (receptacle)
      </text>

      <rect x={20} y={160} width={180} height={40} {...boxStyle} />
      <text x={110} y={180} {...textStyle}>
        Insert
      </text>
      <text x={110} y={196} {...subStyle}>
        your physical bin
      </text>

      <line
        x1={110}
        y1={200}
        x2={110}
        y2={230}
        stroke={arrow}
        markerEnd="url(#arrowhead)"
      />
      <text x={145} y={218} {...labelStyle} textAnchor="start">
        contains
      </text>

      <rect x={20} y={230} width={180} height={40} {...boxStyle} />
      <text x={110} y={250} {...textStyle}>
        Cell
      </text>
      <text x={110} y={266} {...subStyle}>
        A1, A2, B1…
      </text>

      {/* Right column: Template + Item + Assignment */}
      <rect
        x={410}
        y={160}
        width={180}
        height={40}
        {...boxStyle}
        fill="rgba(59,130,246,0.1)"
        stroke="#1e40af"
      />
      <text x={500} y={180} {...textStyle}>
        Template
      </text>
      <text x={500} y={196} {...subStyle}>
        Plano 3600, Gridfinity…
      </text>
      {/* Template → Insert (built from) */}
      <line
        x1={410}
        y1={180}
        x2={203}
        y2={180}
        stroke={arrow}
        strokeDasharray="4 3"
        markerEnd="url(#arrowhead)"
      />
      <text x={306} y={174} {...labelStyle}>
        built from
      </text>

      <rect
        x={410}
        y={230}
        width={180}
        height={40}
        {...boxStyle}
        fill="rgba(251,191,36,0.08)"
        stroke="#92400e"
      />
      <text x={500} y={250} {...textStyle}>
        Item
      </text>
      <text x={500} y={266} {...subStyle}>
        10kΩ resistor, M3 screw
      </text>

      {/* Item → Cell via Assignment */}
      <line
        x1={410}
        y1={250}
        x2={203}
        y2={250}
        stroke={arrow}
        markerEnd="url(#arrowhead)"
      />
      <text x={306} y={244} {...labelStyle}>
        assigned to
      </text>
    </svg>
  );
}
