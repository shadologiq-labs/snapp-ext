import { describe, it, expect } from "vitest";
import LINKER_LIB from "../src/lib/linker.js";

describe("getLinkLabel", () => {
  it("labels a ServiceNow .do record link", () => {
    expect(
      LINKER_LIB.getLinkLabel("https://example.service-now.com/change_request.do?sys_id=abc")
    ).toBe("View Change Request Record");
  });

  it("converts underscores to spaces in table name", () => {
    expect(
      LINKER_LIB.getLinkLabel("https://example.service-now.com/my_custom_table.do?sys_id=x")
    ).toBe("View My Custom Table Record");
  });

  it("returns GitHub Repo for github.com", () => {
    expect(LINKER_LIB.getLinkLabel("https://github.com/org/repo")).toBe("GitHub Repo");
  });

  it("returns Jira Ticket for jira hostnames", () => {
    expect(LINKER_LIB.getLinkLabel("https://company.jira.com/browse/PROJ-1")).toBe("Jira Ticket");
  });

  it("returns Wiki Page for confluence", () => {
    expect(LINKER_LIB.getLinkLabel("https://wiki.confluence.example.com/page")).toBe("Wiki Page");
  });

  it("returns MS Document for microsoft.com", () => {
    expect(LINKER_LIB.getLinkLabel("https://docs.microsoft.com/some/doc")).toBe("MS Document");
  });

  it("returns hostname + ellipsis for paths with depth", () => {
    expect(LINKER_LIB.getLinkLabel("https://example.com/some/path")).toBe("example.com...");
  });

  it("strips www. from hostname", () => {
    expect(LINKER_LIB.getLinkLabel("https://www.example.com/")).toBe("example.com");
  });

  it("returns hostname only (no ellipsis) for root path", () => {
    expect(LINKER_LIB.getLinkLabel("https://example.com/")).toBe("example.com");
  });

  it("returns External Link for an unparseable URL", () => {
    expect(LINKER_LIB.getLinkLabel("not a url at all")).toBe("External Link");
  });

  it("accepts a custom domainLabels map", () => {
    const custom = { "mycompany.com": "Internal Tool" };
    expect(LINKER_LIB.getLinkLabel("https://mycompany.com/tool", custom)).toBe("Internal Tool");
  });
});

describe("extractFromText", () => {
  it("finds a plain http URL", () => {
    const { urls } = LINKER_LIB.extractFromText("see https://example.com/page for details", "");
    expect([...urls]).toContain("https://example.com/page");
  });

  it("finds an https URL", () => {
    const { urls } = LINKER_LIB.extractFromText("ref: https://github.com/org/repo", "");
    expect([...urls]).toContain("https://github.com/org/repo");
  });

  it("filters out the base origin", () => {
    const { urls } = LINKER_LIB.extractFromText(
      "https://myinstance.service-now.com/",
      "https://myinstance.service-now.com"
    );
    expect([...urls]).toHaveLength(0);
  });

  it("filters out nav_to.do navigation URLs", () => {
    const { urls } = LINKER_LIB.extractFromText(
      "https://myinstance.service-now.com/nav_to.do?uri=change_request.do",
      ""
    );
    expect([...urls]).toHaveLength(0);
  });

  it("finds an email address", () => {
    const { emails } = LINKER_LIB.extractFromText("contact: jane.doe@example.com", "");
    expect([...emails]).toContain("jane.doe@example.com");
  });

  it("finds multiple emails in one string", () => {
    const { emails } = LINKER_LIB.extractFromText(
      "owner: alice@foo.com, backup: bob@bar.org",
      ""
    );
    expect([...emails]).toContain("alice@foo.com");
    expect([...emails]).toContain("bob@bar.org");
  });

  it("deduplicates repeated URLs", () => {
    const { urls } = LINKER_LIB.extractFromText(
      "https://example.com/a https://example.com/a",
      ""
    );
    expect([...urls]).toHaveLength(1);
  });

  it("deduplicates repeated emails", () => {
    const { emails } = LINKER_LIB.extractFromText(
      "jane@example.com jane@example.com",
      ""
    );
    expect([...emails]).toHaveLength(1);
  });

  it("returns empty sets for plain text with no matches", () => {
    const { urls, emails } = LINKER_LIB.extractFromText("no links here", "");
    expect(urls.size).toBe(0);
    expect(emails.size).toBe(0);
  });

  it("handles empty string", () => {
    const { urls, emails } = LINKER_LIB.extractFromText("", "");
    expect(urls.size).toBe(0);
    expect(emails.size).toBe(0);
  });

  it("handles null input", () => {
    const { urls, emails } = LINKER_LIB.extractFromText(null, "");
    expect(urls.size).toBe(0);
    expect(emails.size).toBe(0);
  });
});

describe("emailDisplayName", () => {
  it("capitalizes the first letter of each word", () => {
    expect(LINKER_LIB.emailDisplayName("jane.doe@example.com")).toBe("Jane Doe");
  });

  it("handles underscores as word separators", () => {
    expect(LINKER_LIB.emailDisplayName("first_last@example.com")).toBe("First Last");
  });

  it("handles hyphens as word separators", () => {
    expect(LINKER_LIB.emailDisplayName("first-last@example.com")).toBe("First Last");
  });

  it("handles mixed separators", () => {
    expect(LINKER_LIB.emailDisplayName("j.doe_smith-r@example.com")).toBe("J Doe Smith R");
  });

  it("handles a local-part with no separators", () => {
    expect(LINKER_LIB.emailDisplayName("jsmith@example.com")).toBe("Jsmith");
  });
});
