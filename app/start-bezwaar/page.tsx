"use client";

import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";

const letterContents = [
  "tegen welke beslissing je bezwaar maakt, inclusief datum en kenmerk",
  "waarom je het niet eens bent met die beslissing",
  "wat volgens jou de juiste uitkomst moet zijn",
  "eventueel een verzoek om je bezwaar toe te lichten tijdens een hoorzitting",
  "eventueel een verzoek om de beslissing nog niet uit te voeren zolang het bezwaar loopt",
];

const preparationChecklist = [
  "houd het besluit erbij; uploaden is in deze workflow verplicht",
  "noteer waarom de beslissing volgens jou niet klopt",
  "bedenk wat je wél wilt dat de instantie beslist",
  "verzamel bewijsstukken als je die hebt",
];

const deliveryChecklist = [
  "controleer eerst de bezwaartermijn; dat is vaak 6 weken",
  "is de termijn bijna voorbij, stuur dan in elk geval alvast een voorlopig bezwaarschrift",
  "stuur een kopie van de beslissing mee, plus bewijsstukken als je die hebt",
  "verstuur bij voorkeur aangetekend én per gewone post en bewaar kopie, verzendbewijs en ontvangstbewijs",
  "is het de laatste dag, breng de brief dan zelf langs of controleer of online indienen mogelijk is",
];

export default function StartBezwaar() {
  const router = useRouter();
  const { setFlow } = useAppStore();

  const handleStart = () => {
    setFlow("bezwaar");
    router.push("/intake/bezwaar");
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Card>
        <div className="mb-8 text-center">
          <h1 className="mb-4 text-3xl font-bold text-gray-900">Bezwaarschrift Opstellen</h1>
          <p className="mx-auto max-w-2xl text-gray-600">
            In deze workflow werk je stap voor stap toe naar een bezwaarbrief waarin duidelijk staat
            tegen welke beslissing je opkomt, waarom je het er niet mee eens bent en wat volgens jou
            de juiste uitkomst moet zijn.
          </p>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-5">
            <h3 className="mb-2 font-semibold text-blue-900">Wat is een bezwaarschrift?</h3>
            <p className="text-sm leading-6 text-blue-800">
              Met een bezwaarschrift vraag je een bestuursorgaan om een besluit opnieuw te bekijken.
              Hulp van een advocaat is niet verplicht, maar kan wel verstandig zijn.
            </p>
          </div>

          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-5">
            <h3 className="mb-2 font-semibold text-yellow-900">Termijn eerst controleren</h3>
            <p className="text-sm leading-6 text-yellow-800">
              Je hebt meestal 6 weken om bezwaar te maken. Staat de termijn onder druk, stuur dan
              eerst een voorlopig bezwaarschrift en werk je motivering later uit.
            </p>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <div className="rounded-xl border border-[var(--border)] bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Dit komt in de brief
            </h3>
            <ul className="space-y-2 text-sm leading-6 text-[var(--foreground)]">
              {letterContents.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="font-semibold text-[var(--brand)]">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Leg dit alvast klaar
            </h3>
            <ul className="space-y-2 text-sm leading-6 text-[var(--foreground)]">
              {preparationChecklist.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="font-semibold text-[var(--brand)]">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
              Voor verzending
            </h3>
            <ul className="space-y-2 text-sm leading-6 text-[var(--foreground)]">
              {deliveryChecklist.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="font-semibold text-[var(--brand)]">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-indigo-200 bg-indigo-50 p-5">
          <h3 className="mb-2 font-semibold text-indigo-900">Wat deze tool voor je doet</h3>
          <p className="text-sm leading-6 text-indigo-800">
            De intake helpt je om de beslissing, je gronden en je gewenste uitkomst scherp te krijgen.
            Daarna genereren we een formele bezwaarbrief in de lijn van een klassieke voorbeeldbrief:
            aanhef, verwijzing naar het besluit, motivering, verzoek en bijlagevermelding.
          </p>
        </div>

        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-5">
          <h3 className="mb-2 font-semibold text-red-900">Belangrijk</h3>
          <p className="text-sm leading-6 text-red-800">
            Dit is geen juridisch advies. De tool helpt je structureren en formuleren, maar jij
            controleert zelf de inhoud, de termijn en de verzending.
          </p>
        </div>

        <div className="mt-8 space-y-3">
          <p className="text-sm text-gray-600">
            &#10003; Je hebt het besluit bij de hand
            <br />
            &#10003; Je hebt ongeveer 10-15 minuten
            <br />
            &#10003; Je bent klaar om je bezwaar en bijlagen te controleren
          </p>

          <div className="flex gap-4 pt-4">
            <Button onClick={handleStart} size="lg" className="flex-1">
              Start Bezwaar
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => router.back()}
              className="flex-1"
            >
              Terug
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
