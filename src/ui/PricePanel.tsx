import type { PriceBreakdown } from "../engine/types";
import { bdt } from "./format";

interface Props {
    status: "idle" | "loading" | "ok" | "error";
    breakdown: PriceBreakdown | null;
    error: string | null;
    retry: () => void;
}

export function PricePanel({ status, breakdown, retry }: Props) {
    if (status === "idle") return <p>Pick items to see a price.</p>;
    if (status === "loading") return <p>Calculating price...</p>;
    if (status === "error") {
        return (
            <p>
                Price could not be loaded. Your configuration is kept.{" "}
                <button type="button" onClick={retry}>
                    Retry
                </button>
            </p>
        );
    }
    const b = breakdown!;
    return (
        <dl>
            <dt>Subtotal</dt>
            <dd>{bdt(b.subtotal)}</dd>
            <dt>C1 (100 BDT off at 1,200+)</dt>
            <dd>{bdt(b.c1)}</dd>
            <dt>C2 (MORNING15)</dt>
            <dd>{bdt(b.c2)}</dd>
            <dt>Applied</dt>
            <dd>{b.applied ?? "none"} (-{bdt(b.discount)})</dd>
            <dt>After discount</dt>
            <dd>{bdt(b.discountedSubtotal)}</dd>
            <dt>VAT 5%</dt>
            <dd>{bdt(b.vat)}</dd>
            <dt>Payable</dt>
            <dd>
                <strong>{bdt(b.payable)}</strong>
            </dd>
        </dl>
    );
}