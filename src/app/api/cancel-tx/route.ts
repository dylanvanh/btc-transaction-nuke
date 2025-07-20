import { NextRequest, NextResponse } from "next/server";
import { cancelTx } from "@/app/lib/core/cancel-tx";
import { z } from "zod";
import { TransactionCancellationError } from "@/app/lib/core/errors";

const CancelTxSchema = z.object({
  transactionId: z.string().min(1),
  userWalletInfo: z.object({
    paymentAddress: z.string().min(1),
    paymentPublicKey: z.string().min(1),
    ordinalsAddress: z.string().min(1),
    ordinalsPublicKey: z.string().min(1),
  }),
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

    const { transactionId, userWalletInfo } = parseResult.data;

    const result = await cancelTx(transactionId, userWalletInfo);

    return NextResponse.json({
      success: true,
      message: result.message,
      replacementTxId: result.replacementTxId,
      feeRate: result.feeRate,
      totalFee: result.totalFee,
      userUtxosUsed: result.userUtxosUsed,
      unsignedPsbt: result.unsignedPsbt,
      scenario: result.scenario,
      inputSigningMap: result.inputSigningMap,
    });
  } catch (error) {

    if (error instanceof TransactionCancellationError) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}
