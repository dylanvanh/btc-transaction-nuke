import { NextRequest, NextResponse } from "next/server";
import { cancelTx } from "@/app/lib/core/cancel-tx";
import { z } from "zod";

const CancelTxSchema = z.object({
  transactionId: z.string().min(1),
  userPaymentAddress: z.string().min(1),
  paymentPublicKey: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parseResult = CancelTxSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request data", details: parseResult.error.errors },
        { status: 400 },
      );
    }

    const {
      transactionId,
      userPaymentAddress,
      paymentPublicKey,
    } = parseResult.data;

    const result = await cancelTx(
      transactionId,
      userPaymentAddress,
      paymentPublicKey,
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        replacementTxId: result.replacementTxId,
        feeRate: result.feeRate,
        totalFee: result.totalFee,
        userUtxosUsed: result.userUtxosUsed,
        unsignedPsbt: result.unsignedPsbt,
      });
    } else {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }
  } catch (error) {
    console.error("Cancel transaction API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

