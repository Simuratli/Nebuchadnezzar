"use client";

import { useTranslations } from "next-intl";
import type { CardName, Category, EventCard, Person } from "@/lib/types";
import { useAtlas } from "@/store/atlas";

function Names({ names, people, testId }: { names: CardName[]; people: Person[]; testId?: string }) {
  const selectPerson = useAtlas((s) => s.selectPerson);
  return (
    <span data-testid={testId}>
      {names.map((n, i) => {
        const person = n.qid ? people.find((p) => p.wikidata_id === n.qid) : undefined;
        return (
          <span key={`${n.qid ?? n.name}-${i}`}>
            {i > 0 && ", "}
            {person ? (
              <button type="button" onClick={() => selectPerson(person.id)} data-testid="fact-person" className="text-accent underline">
                {n.name}
              </button>
            ) : (
              n.name
            )}
          </span>
        );
      })}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 py-1.5">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

/** Facts in one fixed layout per kind of event. Rows without data are left out, not guessed. */
export function EventFacts({ card, category, people }: { card: EventCard | null; category: Category; people: Person[] }) {
  const t = useTranslations("facts");
  if (!card) return null;
  const sides = card.sides.filter((s) => s.parties.length > 0 || s.commanders.length > 0);
  // Without opposing sides from the infobox, Wikidata only offers an unordered list of parties.
  const hasSides = sides.length >= 2;
  const isTreaty = category === "antlasma";
  const flatParties = hasSides ? [] : card.parties.length > 0 ? card.parties : sides.flatMap((s) => s.parties);
  const flatCommanders = hasSides ? [] : sides.flatMap((s) => s.commanders);
  const empty =
    !hasSides && flatParties.length === 0 && flatCommanders.length === 0 && card.signatories.length === 0 && card.places.length === 0 && card.part_of.length === 0 && !card.result;
  if (empty) return null;

  return (
    <section className="mt-5 rounded border border-line p-3 text-sm" data-testid="event-facts">
      <h3 className="mb-1 font-serif text-lg font-semibold">{t("title")}</h3>
      <dl className="divide-y divide-line">
        {card.places.length > 0 && (
          <Row label={t("place")}>
            <Names names={card.places} people={people} testId="fact-place" />
          </Row>
        )}
        {card.part_of.length > 0 && (
          <Row label={t("partOf")}>
            <Names names={card.part_of} people={people} testId="fact-part-of" />
          </Row>
        )}
        {hasSides &&
          sides.map((s, i) => (
            <Row key={i} label={t("side", { number: i + 1 })}>
              <div data-testid="fact-side">
                {s.parties.length > 0 && <Names names={s.parties} people={people} />}
                {s.commanders.length > 0 && (
                  <p className="mt-1 text-muted">
                    {t("commanders")}: <Names names={s.commanders} people={people} testId="fact-commanders" />
                  </p>
                )}
              </div>
            </Row>
          ))}
        {flatParties.length > 0 && (
          <Row label={t("parties")}>
            <Names names={flatParties} people={people} testId="fact-parties" />
          </Row>
        )}
        {flatCommanders.length > 0 && (
          <Row label={t("commanders")}>
            <Names names={flatCommanders} people={people} testId="fact-commanders" />
          </Row>
        )}
        {card.signatories.length > 0 && (
          <Row label={t("signatories")}>
            <Names names={card.signatories} people={people} testId="fact-signatories" />
          </Row>
        )}
        {card.result && (
          <Row label={isTreaty ? t("outcome") : t("result")}>
            <span data-testid="fact-result" lang="en">
              {card.result}
            </span>
          </Row>
        )}
      </dl>
      <p className="mt-2 text-xs text-muted">{isTreaty ? t("treatyNote") : t("note")}</p>
    </section>
  );
}
