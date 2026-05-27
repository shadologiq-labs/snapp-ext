import { describe, it, expect } from "vitest";
import SNAPP_LIB from "../src/lib/text.js";

describe("escapeHtml", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(SNAPP_LIB.escapeHtml(`<a href="x">&'"</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&quot;&lt;/a&gt;"
    );
  });

  it("handles null/undefined as empty", () => {
    expect(SNAPP_LIB.escapeHtml(null)).toBe("null");
    expect(SNAPP_LIB.escapeHtml(undefined)).toBe("undefined");
  });
});

describe("truncateDesc", () => {
  it("returns the trimmed string when under 120 chars", () => {
    expect(SNAPP_LIB.truncateDesc("  hello world  ")).toBe("hello world");
  });

  it("appends ... when over 120 chars", () => {
    const s = "x".repeat(125);
    const out = SNAPP_LIB.truncateDesc(s);
    expect(out.length).toBe(123);
    expect(out.endsWith("...")).toBe(true);
    expect(out.startsWith("x".repeat(120))).toBe(true);
  });

  it("does not append ... at exactly 120 chars", () => {
    const s = "y".repeat(120);
    expect(SNAPP_LIB.truncateDesc(s)).toBe(s);
  });

  it("handles null/undefined as empty", () => {
    expect(SNAPP_LIB.truncateDesc(null)).toBe("");
    expect(SNAPP_LIB.truncateDesc(undefined)).toBe("");
  });
});

describe("normalizeGeographies", () => {
  it("collapses all four regions to GLOBAL", () => {
    expect(
      SNAPP_LIB.normalizeGeographies("APLA, EMEA, Greater China, North America")
    ).toBe("GLOBAL");
  });

  it("collapses three regions (no GC) to GLOBAL (Excl Greater China)", () => {
    expect(SNAPP_LIB.normalizeGeographies("APLA, EMEA, North America")).toBe(
      "GLOBAL (Excl Greater China)"
    );
  });

  it("is case-insensitive on input", () => {
    expect(
      SNAPP_LIB.normalizeGeographies("apla, emea, greater china, north america")
    ).toBe("GLOBAL");
  });

  it("does not collapse a single region", () => {
    expect(SNAPP_LIB.normalizeGeographies("EMEA")).toBe("EMEA");
  });

  it("uppercases unmatched combinations", () => {
    expect(SNAPP_LIB.normalizeGeographies("EMEA, North America")).toBe(
      "EMEA, NORTH AMERICA"
    );
  });

  it("returns empty string for falsy input", () => {
    expect(SNAPP_LIB.normalizeGeographies("")).toBe("");
    expect(SNAPP_LIB.normalizeGeographies(null)).toBe("");
  });
});

describe("priorityFromRawValue", () => {
  it("maps 1..5 to S1..S5", () => {
    expect(SNAPP_LIB.priorityFromRawValue("1")).toBe("S1");
    expect(SNAPP_LIB.priorityFromRawValue("5")).toBe("S5");
  });

  it("accepts numeric input", () => {
    expect(SNAPP_LIB.priorityFromRawValue(3)).toBe("S3");
  });

  it("returns empty string for unmapped values", () => {
    expect(SNAPP_LIB.priorityFromRawValue("0")).toBe("");
    expect(SNAPP_LIB.priorityFromRawValue("6")).toBe("");
    expect(SNAPP_LIB.priorityFromRawValue("")).toBe("");
    expect(SNAPP_LIB.priorityFromRawValue(null)).toBe("");
  });
});

describe("normalizeResolution", () => {
  const esc = SNAPP_LIB.escapeHtml;

  it("returns empty string for no content", () => {
    expect(SNAPP_LIB.normalizeResolution("", esc)).toBe("");
    expect(SNAPP_LIB.normalizeResolution("   \n\n  ", esc)).toBe("");
  });

  it("rewrites Business Impact: -> Impact:", () => {
    expect(SNAPP_LIB.normalizeResolution("Business Impact: down", esc)).toBe(
      "Impact: down"
    );
  });

  it("rewrites Actions Taken: -> Status:", () => {
    expect(
      SNAPP_LIB.normalizeResolution("Actions Taken: restart", esc)
    ).toBe("Status: restart");
  });

  it("joins multiple non-empty lines with <br>", () => {
    const out = SNAPP_LIB.normalizeResolution("line one\n\nline two\n", esc);
    expect(out).toBe("line one<br>line two");
  });

  it("preserves existing <br> tags through line splitting", () => {
    const out = SNAPP_LIB.normalizeResolution("a<br>b\nc", esc);
    expect(out).toBe("a<br>b<br>c");
  });

  it("escapes HTML in each surviving line", () => {
    const out = SNAPP_LIB.normalizeResolution("a <script>x</script>", esc);
    expect(out).toBe("a &lt;script&gt;x&lt;/script&gt;");
  });

  it("preserves <br /> with self-closing slash", () => {
    expect(SNAPP_LIB.normalizeResolution("a<br />b", esc)).toBe("a<br>b");
  });
});

describe("isTemplateAlreadyApplied", () => {
  it("returns true when current starts with full template", () => {
    expect(SNAPP_LIB.isTemplateAlreadyApplied("hdr\nbody", "hdr\nbody")).toBe(
      true
    );
  });

  it("returns true when current starts with template header line only", () => {
    expect(
      SNAPP_LIB.isTemplateAlreadyApplied("hdr line\nuser content", "hdr line\nother body")
    ).toBe(true);
  });

  it("returns false when current does not match", () => {
    expect(
      SNAPP_LIB.isTemplateAlreadyApplied("something else", "hdr\nbody")
    ).toBe(false);
  });

  it("returns true when template is empty (no-op safety)", () => {
    expect(SNAPP_LIB.isTemplateAlreadyApplied("anything", "")).toBe(true);
  });

  it("returns false when current is empty and template is not", () => {
    expect(SNAPP_LIB.isTemplateAlreadyApplied("", "hdr\nbody")).toBe(false);
  });
});

describe("pickAnchorText", () => {
  const lookups = (map) => (kind, field) => map[`${kind}:${field || ""}`] || "";

  it("uses number first for standard tables", () => {
    const out = SNAPP_LIB.pickAnchorText(
      "change_request",
      lookups({ "number:": "CHG123", "display:u_name": "ignored" })
    );
    expect(out).toBe("CHG123");
  });

  it("falls back to u_name then name then sys_id for standard tables", () => {
    expect(
      SNAPP_LIB.pickAnchorText("incident", lookups({ "display:u_name": "alpha" }))
    ).toBe("alpha");
    expect(
      SNAPP_LIB.pickAnchorText("incident", lookups({ "display:name": "beta" }))
    ).toBe("beta");
    expect(
      SNAPP_LIB.pickAnchorText("incident", lookups({ "sysId:": "abc123" }))
    ).toBe("abc123");
  });

  it("skips number for service tables and prefers name", () => {
    const out = SNAPP_LIB.pickAnchorText(
      "cmdb_ci_service",
      lookups({ "number:": "SVC999", "display:name": "Payments API" })
    );
    expect(out).toBe("Payments API");
  });

  it("skips number for business tables", () => {
    const out = SNAPP_LIB.pickAnchorText(
      "business_application",
      lookups({ "number:": "BIZ1", "display:u_name": "App X" })
    );
    expect(out).toBe("App X");
  });

  it("falls back to raw when display is empty", () => {
    expect(
      SNAPP_LIB.pickAnchorText("incident", lookups({ "raw:u_name": "raw-val" }))
    ).toBe("raw-val");
  });

  it("returns empty string when nothing is available", () => {
    expect(SNAPP_LIB.pickAnchorText("incident", () => "")).toBe("");
  });
});

describe("buildRecordHref", () => {
  it("builds the nav_to.do URL with encoded uri param", () => {
    const out = SNAPP_LIB.buildRecordHref(
      "https://example.service-now.com",
      "incident",
      "abc123"
    );
    expect(out).toBe(
      "https://example.service-now.com/nav_to.do?uri=incident.do%3Fsys_id%3Dabc123%26sysparm_userpref.incident.view%3D%26sysparm_userpref.incident_list.view%3D"
    );
  });
});

describe("resolveTableFromUrl", () => {
  it("extracts table from /<table>.do path", () => {
    expect(
      SNAPP_LIB.resolveTableFromUrl("https://x.service-now.com/incident.do?sys_id=1")
    ).toBe("incident");
  });

  it("extracts table from sysparm_table query param", () => {
    expect(
      SNAPP_LIB.resolveTableFromUrl(
        "https://x.service-now.com/nav_to.do?sysparm_table=incident"
      )
    ).toBe("incident");
  });

  it("extracts table from nested uri param", () => {
    expect(
      SNAPP_LIB.resolveTableFromUrl(
        "https://x.service-now.com/nav_to.do?uri=" +
          encodeURIComponent("change_request.do?sys_id=z")
      )
    ).toBe("change_request");
  });

  it("returns empty string for malformed URL", () => {
    expect(SNAPP_LIB.resolveTableFromUrl("not a url")).toBe("");
  });
});

describe("resolveSysIdFromUrl", () => {
  it("extracts sys_id query param", () => {
    expect(
      SNAPP_LIB.resolveSysIdFromUrl("https://x.service-now.com/incident.do?sys_id=abc")
    ).toBe("abc");
  });

  it("extracts sysparm_sys_id query param", () => {
    expect(
      SNAPP_LIB.resolveSysIdFromUrl(
        "https://x.service-now.com/nav_to.do?sysparm_sys_id=def"
      )
    ).toBe("def");
  });

  it("treats -1 as no value", () => {
    expect(
      SNAPP_LIB.resolveSysIdFromUrl("https://x.service-now.com/incident.do?sys_id=-1")
    ).toBe("");
  });
});

describe("htmlToPlainText", () => {
  it("converts <br> tags to newlines then strips other tags", () => {
    expect(SNAPP_LIB.htmlToPlainText("<p>a<br>b</p>")).toBe("a b");
  });

  it("collapses runs of whitespace", () => {
    expect(SNAPP_LIB.htmlToPlainText("hello   world\n\n")).toBe("hello world");
  });

  it("handles empty input", () => {
    expect(SNAPP_LIB.htmlToPlainText("")).toBe("");
    expect(SNAPP_LIB.htmlToPlainText(null)).toBe("");
  });
});
