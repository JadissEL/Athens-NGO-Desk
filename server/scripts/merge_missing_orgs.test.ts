import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { planBundleUpsert, type NgoBundle } from "./merge_missing_orgs.ts";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function bundle(partial: Partial<NgoBundle> & Pick<NgoBundle, "registry">): NgoBundle {
  return {
    possibility: { meta: {}, organizations: [] },
    summary: { meta: {}, researched: [] },
    emails: { meta: {}, contacts: [] },
    media: { articles: [{ id: "keep-me" }] },
    ...partial,
  };
}

test("inserts missing ids and leaves existing organization objects unchanged", () => {
  const kept = {
    id: "ngo-001-metadrasi",
    name: "Steward edited name",
    notes: "do not wipe",
  };
  const onlyPublished = { id: "ngo-900-local-only", name: "Published only" };
  const existing = bundle({
    registry: {
      meta: { title: "Keep title", count: 99, note: "keep note" },
      organizations: [kept, onlyPublished],
    },
    possibility: {
      meta: { question: "keep" },
      organizations: [{ id: "ngo-001-metadrasi", name: "Old", possibility: "High", score: 90 }],
      unresearchedNote: { count: 1, message: "keep" },
    },
    emails: {
      meta: {},
      contacts: [
        {
          orgId: "ngo-001-metadrasi",
          name: "METAdrasi",
          email: "cv@metadrasi.org",
          kind: "recruitment",
          note: "keep",
        },
      ],
    },
  });
  const source = bundle({
    registry: {
      meta: { title: "From file", count: 3 },
      organizations: [
        { id: "ngo-001-metadrasi", name: "METAdrasi", notes: "file copy" },
        { id: "ngo-105-cretanscent", name: "CretanSCENT" },
        { id: "ngo-106-n-idaia", name: "N-Idaia" },
      ],
    },
    possibility: {
      organizations: [
        { id: "ngo-001-metadrasi", name: "METAdrasi", possibility: "Very high", score: 92 },
        { id: "ngo-105-cretanscent", name: "CretanSCENT", possibility: "Unmeasured", score: null },
      ],
    },
    emails: {
      contacts: [
        {
          orgId: "ngo-001-metadrasi",
          name: "Replacement",
          email: "new@example.test",
          kind: "recruitment",
          note: "should not replace",
        },
        {
          orgId: "ngo-105-cretanscent",
          name: "CretanSCENT",
          email: "hello@cretanscent.gr",
          kind: "general",
          note: "new",
        },
      ],
    },
    summary: {
      researched: [{ id: "ngo-105-cretanscent", name: "CretanSCENT", status: "pending", totalFound: null }],
    },
    media: { articles: [{ id: "do-not-copy" }] },
  });

  const plan = planBundleUpsert(existing, source);
  assert.deepEqual(plan.addedIds, ["ngo-105-cretanscent", "ngo-106-n-idaia"]);

  const orgs = (plan.bundle.registry as { organizations: { id: string; name: string }[] }).organizations;
  assert.equal(orgs[0], kept);
  assert.equal(orgs[0].name, "Steward edited name");
  assert.equal(orgs[1], onlyPublished);
  assert.equal(orgs[2].name, "CretanSCENT");
  assert.equal(orgs[3].name, "N-Idaia");

  const meta = (plan.bundle.registry as { meta: { title: string; count: number; note: string } }).meta;
  assert.equal(meta.title, "Keep title");
  assert.equal(meta.note, "keep note");
  assert.equal(meta.count, 4);

  const scores = (
    plan.bundle.possibility as { organizations: { id: string; score: number | null }[]; unresearchedNote: { message: string } }
  ).organizations;
  assert.equal(scores[0].score, 90);
  assert.equal(scores[1].id, "ngo-105-cretanscent");
  assert.equal(scores.length, 2);
  assert.equal(
    (plan.bundle.possibility as { unresearchedNote: { message: string } }).unresearchedNote.message,
    "keep"
  );

  const contacts = (plan.bundle.emails as { contacts: { orgId: string; email: string }[] }).contacts;
  assert.equal(contacts.length, 2);
  assert.equal(contacts[0].email, "cv@metadrasi.org");
  assert.equal(contacts[1].orgId, "ngo-105-cretanscent");

  const researched = (plan.bundle.summary as { researched: { id: string }[] }).researched;
  assert.deepEqual(
    researched.map((row) => row.id),
    ["ngo-105-cretanscent"]
  );
  assert.equal((plan.bundle.media as { articles: { id: string }[] }).articles[0].id, "keep-me");

  source.registry = {
    meta: {},
    organizations: [{ id: "ngo-105-cretanscent", name: "mutated after plan" }],
  };
  assert.equal(orgs[2].name, "CretanSCENT");

  const again = planBundleUpsert(plan.bundle, source);
  assert.deepEqual(again.addedIds, []);
  assert.equal(again.bundle, plan.bundle);
});

test("data/ngos Crete rows are the three ids missing from a 104-org bundle", () => {
  const registry = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "data/ngos/athens_greece.json"), "utf8")
  ) as { meta: { count: number }; organizations: { id: string; name: string }[] };
  const possibility = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "data/ngos/job_possibility.json"), "utf8")
  ) as { organizations: { id: string }[] };
  const crete = new Set([
    "ngo-105-cretanscent-union-of-social-economy-entities-crete",
    "ngo-106-n-idaia-synergasia-social-co-operative",
    "ngo-107-oramati-zo-social-co-operative",
  ]);
  const existing = bundle({
    registry: {
      meta: { ...registry.meta, count: 104 },
      organizations: registry.organizations.filter((org) => !crete.has(org.id)),
    },
    possibility: {
      ...possibility,
      organizations: possibility.organizations.filter((org) => !crete.has(org.id)),
    },
  });
  const source = bundle({ registry, possibility });
  const plan = planBundleUpsert(existing, source);
  assert.deepEqual(plan.addedIds, [...crete]);
  const orgs = (plan.bundle.registry as { organizations: { id: string }[]; meta: { count: number } });
  assert.equal(orgs.organizations.length, registry.organizations.length);
  assert.equal(orgs.meta.count, registry.organizations.length);
  assert.equal(orgs.organizations[0].id, "ngo-001-metadrasi");
  const scores = (plan.bundle.possibility as { organizations: { id: string }[] }).organizations;
  assert.equal(scores.filter((org) => crete.has(org.id)).length, 3);
});
