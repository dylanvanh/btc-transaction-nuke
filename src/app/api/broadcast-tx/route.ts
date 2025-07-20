import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { mempoolClient } from "@/app/lib/clients/mempool-client";
import { bitcoin } from "@/app/lib/core/config";

const BroadcastTxSchema = z.object({
  signedPsbtHex: z.string().min(1, "Signed PSBT hex is required"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { signedPsbtHex } = BroadcastTxSchema.parse(body);

    const psbt = bitcoin.Psbt.fromHex(signedPsbtHex);

    psbt.finalizeAllInputs();
    const rawTxHex = psbt.extractTransaction().toHex();

    const txId = await mempoolClient.broadcastTransaction(rawTxHex);

    return NextResponse.json({
      success: true,
      txId: txId,
      message: "Transaction broadcast successfully",
    });
  } catch (error) {

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: error.errors,
          success: false,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to broadcast transaction",
        success: false,
      },
      { status: 500 },
    );
  }
}

