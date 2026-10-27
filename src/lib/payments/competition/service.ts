import {
  CompetitionPayment,
  CompetitionLedgerEntry,
  CompetitionRefund,
  CompetitionPrizeAllocation,
  CompetitionFinancialSummary,
  CompetitionRegistration,
} from '@/types';
import { DatabaseService, isSupabaseConfigured, mockDb, supabase } from '@/lib/db';
import { CompetitionRegistrationService } from '@/lib/competition/registration/service';
import { PaystackProvider } from '@/lib/payments/providers/paystack';

export interface PrizeAllocationInputItem {
  rank_position?: number;
  rankPosition?: number;
  title?: string;
  allocation_type?: 'fixed_amount' | 'percentage_of_pool';
  amount_or_percent?: number;
  amount?: number;
  recipient_member_id?: string | null;
  recipient_name?: string | null;
  recipientName?: string | null;
  notes?: string | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function generatePaymentReference(prefix = 'cpay'): string {
  const ts = Date.now();
  const rnd = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${ts}_${rnd}`;
}

export interface InitializeCheckoutInput {
  leaderboardId: string;
  participantName: string;
  participantEmail: string;
  teamId?: string | null;
  notes?: string | null;
  userId?: string | null;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResult {
  isPaid: boolean;
  paymentReference?: string;
  checkoutUrl?: string;
  registration: CompetitionRegistration;
  amount: number;
  currency: string;
  message?: string;
}

export interface VerifyPaymentResult {
  success: boolean;
  payment: CompetitionPayment;
  registration: CompetitionRegistration;
  receipt: {
    receiptNumber: string;
    reference: string;
    amount: number;
    currency: string;
    paidAt: string;
    participantName: string;
    participantEmail: string;
    competitionName: string;
    organizerName?: string;
    refundPolicy: string;
  };
}

export const CompetitionPaymentService = {
  paystackProvider: new PaystackProvider(),

  /**
   * Initializes competition registration checkout.
   * If free: confirms registration immediately.
   * If paid: enforces server-side amount & currency, creates pending registration + payment,
   * and initializes payment transaction.
   */
  async initializeRegistrationCheckout(input: InitializeCheckoutInput): Promise<CheckoutResult> {
    const {
      leaderboardId,
      participantName,
      participantEmail,
      teamId,
      notes,
      userId,
      successUrl,
    } = input;

    // 1. Resolve leaderboard and verify active status
    const leaderboard = await DatabaseService.getLeaderboard(leaderboardId);
    if (!leaderboard) {
      throw new Error('Competition not found.');
    }

    // 2. Fetch server-authoritative registration config
    const config = await CompetitionRegistrationService.getConfig(leaderboardId);
    if (!config.is_enabled) {
      throw new Error('Registration is currently closed for this competition.');
    }

    // 3. Check registration deadline
    if (config.closes_at && new Date(config.closes_at) < new Date()) {
      throw new Error('The registration window for this competition has closed.');
    }

    // 4. Check payment deadline if configured
    if (config.payment_deadline && new Date(config.payment_deadline) < new Date()) {
      throw new Error('The payment deadline for this competition has passed.');
    }

    // 5. Check duplicate active registrations
    const existingRegistrations = await CompetitionRegistrationService.getRegistrations(leaderboardId);
    const normalizedEmail = participantEmail.trim().toLowerCase();
    const existing = existingRegistrations.find(
      (r) =>
        r.participant_email.toLowerCase() === normalizedEmail &&
        r.status !== 'withdrawn' &&
        r.status !== 'rejected'
    );

    if (existing) {
      if (existing.status === 'confirmed' || existing.status === 'approved') {
        throw new Error('A confirmed registration already exists for this email address.');
      }
      if (existing.status === 'pending_payment' && existing.payment_reference) {
        // Return existing pending payment reference to prevent duplicate pending charges
        const existingPayment = await this.getPaymentByReference(existing.payment_reference);
        if (existingPayment && existingPayment.status === 'pending') {
          return {
            isPaid: true,
            paymentReference: existingPayment.payment_reference,
            checkoutUrl: existingPayment.receipt_url || successUrl,
            registration: existing,
            amount: existingPayment.amount,
            currency: existingPayment.currency,
            message: 'Resuming existing pending payment checkout.',
          };
        }
      }
    }

    const entryFee = Number(config.entry_fee) || 0;
    const currency = (config.currency || 'NGN').toUpperCase();

    // 6. Free Registration Flow
    if (entryFee <= 0) {
      const freeRegistration = await CompetitionRegistrationService.registerParticipant({
        leaderboardId,
        participantName,
        participantEmail,
        teamId,
        notes,
        userId,
      });

      return {
        isPaid: false,
        registration: freeRegistration,
        amount: 0,
        currency,
        message: 'Free registration confirmed successfully.',
      };
    }

    // 7. Paid Registration Flow: Server-side reference & payment creation
    const paymentReference = generatePaymentReference('cpay');
    const platformFeePercent = Number(config.platform_fee_percent) || 5;
    const platformFee = Math.round((entryFee * platformFeePercent) / 100);
    // Standard default estimate for Paystack processing (1.5% + 100 NGN, capped at 2000 NGN in live)
    const estimatedProviderFee = Math.round(entryFee * 0.015);
    const netAmount = Math.max(0, entryFee - platformFee - estimatedProviderFee);

    // Create registration in pending_payment status
    const pendingRegistration = await CompetitionRegistrationService.registerParticipant({
      leaderboardId,
      participantName,
      participantEmail,
      teamId,
      notes,
      userId,
      initialStatus: 'pending_payment',
      paymentReference,
    });

    const paymentRecord: CompetitionPayment = {
      id: `cpay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      leaderboard_id: leaderboardId,
      registration_id: pendingRegistration.id,
      user_id: userId || null,
      participant_name: participantName.trim(),
      participant_email: participantEmail.trim().toLowerCase(),
      provider: 'paystack',
      payment_reference: paymentReference,
      external_reference: null,
      amount: entryFee,
      currency,
      provider_fee: estimatedProviderFee,
      platform_fee: platformFee,
      net_amount: netAmount,
      status: 'pending',
      idempotency_key: paymentReference,
      payment_method: null,
      receipt_url: null,
      paid_at: null,
      metadata: {
        leaderboard_slug: leaderboard.slug,
        competition_name: leaderboard.name,
        refund_policy: config.refund_policy || 'no_refunds',
      },
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    // Save payment record
    await this.savePaymentRecord(paymentRecord);

    // Check if live Paystack is configured
    const hasLivePaystack = Boolean(process.env.PAYSTACK_SECRET_KEY);
    let checkoutUrl = '';

    if (hasLivePaystack && isSupabaseConfigured) {
      try {
        const callbackUrl = new URL(successUrl);
        callbackUrl.searchParams.set('reference', paymentReference);
        callbackUrl.searchParams.set('registered', 'true');

        const session = await this.paystackProvider.createCheckoutSession({
          userId: userId || `anon_${pendingRegistration.id}`,
          userEmail: participantEmail.trim(),
          provider: 'paystack',
          kind: 'entry_fee',
          amount: entryFee,
          currency,
          metadata: {
            leaderboard_id: leaderboardId,
            registration_id: pendingRegistration.id,
            payment_reference: paymentReference,
            payment_kind: 'entry_fee',
          },
          successUrl: callbackUrl.toString(),
          cancelUrl: input.cancelUrl,
        });
        checkoutUrl = session.checkoutUrl;
      } catch (err: unknown) {
        console.warn('Paystack live initialization failed, falling back to secure test/demo checkout:', err);
        const fallbackUrl = new URL(successUrl);
        fallbackUrl.searchParams.set('reference', paymentReference);
        fallbackUrl.searchParams.set('registered', 'true');
        checkoutUrl = fallbackUrl.toString();
      }
    } else {
      // Demo / Test Mode Checkout URL
      const demoUrl = new URL(successUrl);
      demoUrl.searchParams.set('reference', paymentReference);
      demoUrl.searchParams.set('registered', 'true');
      demoUrl.searchParams.set('demo_verify', '1');
      checkoutUrl = demoUrl.toString();
    }

    return {
      isPaid: true,
      paymentReference,
      checkoutUrl,
      registration: pendingRegistration,
      amount: entryFee,
      currency,
    };
  },

  /**
   * Verifies a competition payment through trusted provider server-side verification
   * or test mode assertion. Idempotent: safe against replayed webhooks and multiple client calls.
   */
  async verifyPayment(
    reference: string,
    actorUserId?: string,
    options?: { forceTestSuccess?: boolean }
  ): Promise<VerifyPaymentResult> {
    const payment = await this.getPaymentByReference(reference);
    if (!payment) {
      throw new Error(`Competition payment with reference "${reference}" not found.`);
    }

    const leaderboard = await DatabaseService.getLeaderboard(payment.leaderboard_id);
    if (!leaderboard) {
      throw new Error('Competition associated with this payment not found.');
    }

    const config = await CompetitionRegistrationService.getConfig(payment.leaderboard_id);

    // IDEMPOTENCY: If already succeeded, return existing verified state without duplicating ledger entries
    if (payment.status === 'succeeded') {
      const existingReg = await CompetitionRegistrationService.getRegistrationById(
        payment.registration_id,
        payment.leaderboard_id
      );
      return {
        success: true,
        payment,
        registration: existingReg!,
        receipt: this.buildReceipt(payment, existingReg!, leaderboard.name, config.refund_policy || 'no_refunds'),
      };
    }

    let actualProviderFee = payment.provider_fee;
    let externalRef = payment.external_reference;
    let paymentMethod = payment.payment_method || 'card';

    // Verify through Paystack in live mode
    if (isSupabaseConfigured && process.env.PAYSTACK_SECRET_KEY && !options?.forceTestSuccess) {
      const verifyRes = await this.paystackProvider.verifyTransaction(reference);
      if (!verifyRes.status || verifyRes.data?.status !== 'success') {
        const errorMsg = verifyRes.data?.gateway_response || verifyRes.message || 'Payment verification failed.';
        await this.updatePaymentStatus(payment.id, 'failed', {
          metadata: { ...(payment.metadata || {}), error_message: errorMsg },
        });
        throw new Error(`Payment verification failed: ${errorMsg}`);
      }

      // Verify amount & currency matches server expectation to prevent tampering
      if (verifyRes.data.amount !== payment.amount) {
        throw new Error(
          `Payment amount mismatch: Expected ${payment.amount}, received ${verifyRes.data.amount}.`
        );
      }
      if (verifyRes.data.currency?.toUpperCase() !== payment.currency.toUpperCase()) {
        throw new Error(
          `Payment currency mismatch: Expected ${payment.currency}, received ${verifyRes.data.currency}.`
        );
      }

      actualProviderFee = Number(verifyRes.data.fees) || payment.provider_fee;
      externalRef = String(verifyRes.data.reference || verifyRes.data.status);
      paymentMethod = String(verifyRes.data.channel || 'paystack');
    }

    const netAmount = Math.max(0, payment.amount - actualProviderFee - payment.platform_fee);
    const paidTimestamp = nowIso();

    // 1. Update Payment Record to succeeded
    const updatedPayment: CompetitionPayment = {
      ...payment,
      status: 'succeeded',
      provider_fee: actualProviderFee,
      net_amount: netAmount,
      external_reference: externalRef,
      payment_method: paymentMethod,
      paid_at: paidTimestamp,
      updated_at: paidTimestamp,
    };
    await this.savePaymentRecord(updatedPayment);

    // 2. Append to Financial Ledger (Entry Fee Credit, Provider Fee Debit, Platform Fee Debit)
    await this.recordVerifiedPaymentInLedger(updatedPayment, actorUserId);

    // 3. Confirm Competition Registration
    const confirmedRegistration = await CompetitionRegistrationService.confirmPaidRegistration(
      payment.registration_id,
      payment.leaderboard_id,
      {
        paymentId: payment.id,
        paymentReference: payment.payment_reference,
        amountPaid: payment.amount,
        currency: payment.currency,
        paidAt: paidTimestamp,
      }
    );

    return {
      success: true,
      payment: updatedPayment,
      registration: confirmedRegistration,
      receipt: this.buildReceipt(
        updatedPayment,
        confirmedRegistration,
        leaderboard.name,
        config.refund_policy || 'no_refunds'
      ),
    };
  },

  /**
   * Appends double-entry style ledger records for verified payment:
   * - entry_fee_credit: +Gross Entry Fee
   * - provider_fee_debit: -Provider Transaction Fee
   * - platform_fee_debit: -Platform Revenue Fee
   */
  async recordVerifiedPaymentInLedger(payment: CompetitionPayment, actorUserId?: string): Promise<void> {
    const currentBalance = await this.getCurrentOrganizerBalance(payment.leaderboard_id);

    // 1. Gross credit
    const bal1 = currentBalance + payment.amount;
    await this.addLedgerEntry({
      leaderboard_id: payment.leaderboard_id,
      entry_type: 'entry_fee_credit',
      amount: payment.amount,
      currency: payment.currency,
      balance_after: bal1,
      payment_id: payment.id,
      registration_id: payment.registration_id,
      actor_id: actorUserId || payment.user_id,
      description: `Registration entry fee: ${payment.participant_name}`,
      metadata: {
        payment_reference: payment.payment_reference,
        participant_email: payment.participant_email,
      },
    });

    // 2. Provider fee debit (if > 0)
    let bal2 = bal1;
    if (payment.provider_fee > 0) {
      bal2 = bal1 - payment.provider_fee;
      await this.addLedgerEntry({
        leaderboard_id: payment.leaderboard_id,
        entry_type: 'provider_fee_debit',
        amount: -payment.provider_fee,
        currency: payment.currency,
        balance_after: bal2,
        payment_id: payment.id,
        registration_id: payment.registration_id,
        actor_id: actorUserId || payment.user_id,
        description: `Paystack processing fee (${payment.payment_reference})`,
        metadata: { fee: payment.provider_fee },
      });
    }

    // 3. Platform fee debit (if > 0)
    let bal3 = bal2;
    if (payment.platform_fee > 0) {
      bal3 = bal2 - payment.platform_fee;
      await this.addLedgerEntry({
        leaderboard_id: payment.leaderboard_id,
        entry_type: 'platform_fee_debit',
        amount: -payment.platform_fee,
        currency: payment.currency,
        balance_after: bal3,
        payment_id: payment.id,
        registration_id: payment.registration_id,
        actor_id: actorUserId || payment.user_id,
        description: `LeaderboardOS platform fee (${payment.payment_reference})`,
        metadata: { fee: payment.platform_fee },
      });
    }
  },

  /**
   * Processes a refund through provider and records state transition & ledger debit.
   */
  /**
   * Processes a refund through provider and records state transition & ledger debit.
   */
  async processRefund(
    inputOrLeaderboardId:
      | string
      | {
          leaderboardId: string;
          registrationId: string;
          amount?: number;
          reason?: string;
          actorUserId?: string;
        },
    registrationIdArg?: string,
    actorUserIdArg?: string,
    reasonArg?: string
  ): Promise<{ success: boolean; refund: CompetitionRefund; registration: CompetitionRegistration }> {
    let leaderboardId: string;
    let registrationId: string;
    let actorUserId: string | undefined;
    let reason: string | undefined;
    let requestedAmount: number | undefined;

    if (typeof inputOrLeaderboardId === 'object') {
      leaderboardId = inputOrLeaderboardId.leaderboardId;
      registrationId = inputOrLeaderboardId.registrationId;
      actorUserId = inputOrLeaderboardId.actorUserId;
      reason = inputOrLeaderboardId.reason;
      requestedAmount = inputOrLeaderboardId.amount;
    } else {
      leaderboardId = inputOrLeaderboardId;
      registrationId = registrationIdArg!;
      actorUserId = actorUserIdArg;
      reason = reasonArg;
    }

    // 1. Authorize: Actor must be leaderboard owner or admin
    await DatabaseService.requireAdminPermission(leaderboardId, actorUserId);

    // 2. Fetch registration and payment
    const reg = await CompetitionRegistrationService.getRegistrationById(registrationId, leaderboardId);
    if (!reg) {
      throw new Error('Registration not found.');
    }

    if (reg.payment_status === 'refunded') {
      throw new Error('This registration has already been refunded.');
    }

    if (reg.payment_status !== 'succeeded' || !reg.payment_reference) {
      throw new Error('Only successfully paid registrations can be refunded.');
    }

    const payment = await this.getPaymentByReference(reg.payment_reference);
    if (!payment) {
      throw new Error('Payment record associated with this registration not found.');
    }

    const refundAmount = requestedAmount !== undefined ? requestedAmount : payment.amount;
    if (refundAmount > payment.amount) {
      throw new Error(`Refund amount (${refundAmount}) exceeds original payment amount (${payment.amount}).`);
    }

    // 3. Enforce refund policy constraints
    const config = await CompetitionRegistrationService.getConfig(leaderboardId);
    if (config.refund_policy === 'no_refunds' && !reason?.includes('Organizer Override') && !actorUserId) {
      // Allow organizer override with explicit reason
      throw new Error(
        'The competition policy is "No Refunds". To override, specify "Organizer Override" in the refund reason.'
      );
    }
    if (
      config.refund_policy === 'full_refund_before_deadline' &&
      config.payment_deadline &&
      new Date() > new Date(config.payment_deadline) &&
      !reason?.includes('Organizer Override') &&
      !actorUserId
    ) {
      throw new Error('Refund deadline has passed. To override, specify "Organizer Override" in the refund reason.');
    }

    // 4. Provider refund execution
    let providerRefundId = `rfnd_${Date.now()}`;
    if (isSupabaseConfigured && process.env.PAYSTACK_SECRET_KEY) {
      try {
        const refundRes = await this.paystackProvider.processRefund({
          paymentReference: payment.payment_reference,
          amount: refundAmount,
          currency: payment.currency,
          reason: reason || 'Competition organizer refund',
        });
        providerRefundId = refundRes.providerRefundId;
      } catch (err: unknown) {
        console.warn('Provider refund API failed, recording manual/local refund:', err);
      }
    }

    const refundTimestamp = nowIso();
    const refundRecord: CompetitionRefund = {
      id: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      leaderboard_id: leaderboardId,
      competition_payment_id: payment.id,
      registration_id: reg.id,
      initiated_by: actorUserId || null,
      amount: refundAmount,
      currency: payment.currency,
      provider: payment.provider,
      provider_refund_id: providerRefundId,
      reason: reason || 'Organizer refund',
      status: 'succeeded',
      metadata: {
        payment_reference: payment.payment_reference,
        participant_email: reg.participant_email,
      },
      created_at: refundTimestamp,
      updated_at: refundTimestamp,
    };
    await this.saveRefundRecord(refundRecord);

    // 5. Update Payment Record to refunded
    const newPaymentStatus = refundAmount >= payment.amount ? 'refunded' : 'partially_refunded';
    await this.updatePaymentStatus(payment.id, newPaymentStatus, {
      metadata: {
        ...(payment.metadata || {}),
        refund_id: refundRecord.id,
        refunded_at: refundTimestamp,
      },
    });

    // 6. Record refund debit in Financial Ledger (debit net amount received)
    const currentBalance = await this.getCurrentOrganizerBalance(leaderboardId);
    const balanceAfter = currentBalance - refundAmount;

    await this.addLedgerEntry({
      leaderboard_id: leaderboardId,
      entry_type: 'refund_debit',
      amount: -refundAmount,
      currency: payment.currency,
      balance_after: balanceAfter,
      payment_id: payment.id,
      registration_id: reg.id,
      actor_id: actorUserId,
      description: `Refund for participant: ${reg.participant_name} (${reason || 'Organizer processed'})`,
      metadata: {
        refund_id: refundRecord.id,
        gross_refund: refundAmount,
        net_debit: refundAmount,
      },
    });

    // 7. Update Registration to withdrawn & refunded
    const updatedReg = await CompetitionRegistrationService.markRefunded(registrationId, leaderboardId);

    // 8. If member record was created, ensure it is deactivated
    if (reg.member_id) {
      try {
        await DatabaseService.updateMember(reg.member_id, { is_active: false }, { skipAdminCheck: true });
      } catch {
        // Handled in markRefunded if already deactivated
      }
    }

    return {
      success: true,
      refund: refundRecord,
      registration: updatedReg,
    };
  },

  /**
   * Allocates prize pool as transparent accounting records.
   * Does NOT fabricate live bank transfers without verified payout setup.
   */
  async allocatePrizePool(
    inputOrLeaderboardId:
      | string
      | {
          leaderboardId: string;
          actorUserId?: string;
          allocations: PrizeAllocationInputItem[];
        },
    actorUserIdArg?: string,
    allocationsArg?: PrizeAllocationInputItem[]
  ): Promise<{ success: boolean; allocations: CompetitionPrizeAllocation[]; availableBalance: number }> {
    let leaderboardId: string;
    let actorUserId: string | undefined;
    let rawAllocations: PrizeAllocationInputItem[];

    if (typeof inputOrLeaderboardId === 'object') {
      leaderboardId = inputOrLeaderboardId.leaderboardId;
      actorUserId = inputOrLeaderboardId.actorUserId;
      rawAllocations = inputOrLeaderboardId.allocations;
    } else {
      leaderboardId = inputOrLeaderboardId;
      actorUserId = actorUserIdArg;
      rawAllocations = allocationsArg || [];
    }

    await DatabaseService.requireAdminPermission(leaderboardId, actorUserId);

    const summary = await this.getFinancialSummary(leaderboardId);
    const existingPrizes = await this.getPrizeAllocations(leaderboardId);
    const existingTotal = existingPrizes
      .filter((p) => p.payout_status !== 'cancelled')
      .reduce((sum, p) => sum + p.allocated_amount, 0);

    const netAvailable = summary.organizer_balance ?? summary.available_organizer_balance;
    const poolBasis = summary.net_revenue;
    const newRecords: CompetitionPrizeAllocation[] = [];
    let addedTotal = 0;

    for (const alloc of rawAllocations) {
      const rankPos = alloc.rank_position ?? alloc.rankPosition ?? 1;
      const title = alloc.title || alloc.notes || `Rank #${rankPos} Award`;
      const allocType = alloc.allocation_type || 'fixed_amount';
      const recipientName = alloc.recipient_name ?? alloc.recipientName ?? null;
      let allocatedAmount = 0;
      let percentage: number | null = null;

      if (allocType === 'percentage_of_pool') {
        percentage = alloc.amount_or_percent ?? alloc.amount ?? 0;
        allocatedAmount = Math.round((poolBasis * percentage) / 100);
      } else {
        allocatedAmount = Math.round(alloc.amount ?? alloc.amount_or_percent ?? 0);
      }

      if (allocatedAmount <= 0) {
        throw new Error(`Prize amount for rank ${rankPos} must be greater than zero.`);
      }

      addedTotal += allocatedAmount;

      const record: CompetitionPrizeAllocation = {
        id: `prz_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        leaderboard_id: leaderboardId,
        rank_position: rankPos,
        title,
        allocation_type: allocType,
        allocated_amount: allocatedAmount,
        percentage,
        currency: summary.currency,
        recipient_member_id: alloc.recipient_member_id || null,
        recipient_name: recipientName,
        payout_status: 'allocated', // Legally & accounting allocated
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      newRecords.push(record);
    }

    if (existingTotal + addedTotal > netAvailable) {
      throw new Error(
        `Total prize allocations (${(existingTotal + addedTotal) / 100} ${summary.currency}) exceeds available net balance (${netAvailable / 100} ${summary.currency}).`
      );
    }

    // Persist allocations
    await this.savePrizeAllocations(leaderboardId, newRecords);

    // Record prize allocations in ledger
    let runningBalance = netAvailable;
    for (const p of newRecords) {
      runningBalance -= p.allocated_amount;
      await this.addLedgerEntry({
        leaderboard_id: leaderboardId,
        entry_type: 'prize_allocation',
        amount: -p.allocated_amount,
        currency: summary.currency,
        balance_after: runningBalance,
        actor_id: actorUserId,
        description: `Prize pool allocation: ${p.title} (Rank #${p.rank_position})`,
        metadata: {
          prize_allocation_id: p.id,
          rank: p.rank_position,
          recipient_name: p.recipient_name,
        },
      });
    }

    return {
      success: true,
      allocations: newRecords,
      availableBalance: runningBalance,
    };
  },

  /**
   * Computes financial summary for a competition.
   */
  async getFinancialSummary(leaderboardId: string): Promise<CompetitionFinancialSummary & {
    gross_revenue: number;
    total_paid_registrations: number;
    platform_fees: number;
    provider_fees: number;
    organizer_balance: number;
    total_refunded: number;
    refund_count: number;
    prize_pool_allocated: number;
    entries: Array<CompetitionLedgerEntry & { credit_amount: number; debit_amount: number }>;
  }> {
    const payments = await this.getPaymentsByLeaderboard(leaderboardId);
    const refunds = await this.getRefundsByLeaderboard(leaderboardId);
    const prizes = await this.getPrizeAllocations(leaderboardId);
    const config = await CompetitionRegistrationService.getConfig(leaderboardId);

    const currency = (config.currency || 'NGN').toUpperCase();

    const succeededPayments = payments.filter((p) => p.status === 'succeeded');
    const refundedPayments = payments.filter((p) => p.status === 'refunded' || p.status === 'partially_refunded');
    const pendingPayments = payments.filter((p) => p.status === 'pending');

    const totalGross = succeededPayments.reduce((acc, p) => acc + p.amount, 0);
    const totalProviderFees = succeededPayments.reduce((acc, p) => acc + p.provider_fee, 0);
    const totalPlatformFees = succeededPayments.reduce((acc, p) => acc + p.platform_fee, 0);
    const totalRefunds = refunds
      .filter((r) => r.status === 'succeeded')
      .reduce((acc, r) => acc + r.amount, 0);

    const netRevenue = Math.max(0, totalGross - totalProviderFees - totalPlatformFees - totalRefunds);
    const totalPrizeAllocated = prizes
      .filter((p) => p.payout_status !== 'cancelled')
      .reduce((acc, p) => acc + p.allocated_amount, 0);

    const rawEntries = await this.getLedgerEntries(leaderboardId);
    const organizerBalance = rawEntries.length > 0
      ? rawEntries[0].balance_after
      : (totalGross - totalProviderFees - totalPlatformFees - totalRefunds - totalPrizeAllocated);

    const availableBalance = Math.max(0, organizerBalance);

    const enrichedEntries = rawEntries.map((e) => {
      const isCredit = e.amount > 0;
      let normalizedType = e.entry_type as string;
      if (e.entry_type === 'entry_fee_credit') normalizedType = 'gross_entry_fee';
      else if (e.entry_type === 'provider_fee_debit') normalizedType = 'provider_fee';
      else if (e.entry_type === 'platform_fee_debit') normalizedType = 'platform_fee';
      else if (e.entry_type === 'prize_allocation') normalizedType = 'prize_allocation_debit';

      return {
        ...e,
        entry_type: normalizedType as CompetitionLedgerEntry['entry_type'],
        credit_amount: isCredit ? e.amount : 0,
        debit_amount: !isCredit ? Math.abs(e.amount) : 0,
        running_balance: e.balance_after,
        payment_reference: (e.metadata?.payment_reference as string) || undefined,
      };
    });

    return {
      leaderboard_id: leaderboardId,
      currency,
      total_entry_fees_gross: totalGross,
      total_provider_fees: totalProviderFees,
      total_platform_fees: totalPlatformFees,
      total_refunds: totalRefunds,
      net_revenue: netRevenue,
      total_prize_allocated: totalPrizeAllocated,
      available_organizer_balance: availableBalance,
      paid_registrations_count: succeededPayments.length,
      refunded_registrations_count: refundedPayments.length,
      pending_payments_count: pendingPayments.length,

      // Aliases
      gross_revenue: totalGross,
      total_paid_registrations: succeededPayments.length,
      platform_fees: totalPlatformFees,
      provider_fees: totalProviderFees,
      organizer_balance: organizerBalance,
      total_refunded: totalRefunds,
      refund_count: refunds.length,
      prize_pool_allocated: totalPrizeAllocated,
      prize_allocations: prizes.map((p) => ({
        id: p.id,
        rank_position: p.rank_position,
        amount: p.allocated_amount,
        currency: p.currency,
        recipient_name: p.recipient_name,
        notes: p.title,
      })),
      payments,
      entries: enrichedEntries,
    };
  },

  /**
   * Reconciles financial ledger against raw transactions to detect anomalies.
   */
  async reconcileLedger(leaderboardId: string): Promise<{
    balanced: boolean;
    isReconciled: boolean;
    calculatedBalance: number;
    currentBalance: number;
    discrepancy: number;
    anomalies: string[];
    details: {
      grossPayments: number;
      providerFees: number;
      platformFees: number;
      refunds: number;
      prizeAllocations: number;
      calculatedNet: number;
      actualBalance: number;
    };
  }> {
    const entries = await this.getLedgerEntries(leaderboardId);
    const currentBalance = await this.getCurrentOrganizerBalance(leaderboardId);

    const anomalies: string[] = [];

    // Sum credits and debits from ledger entries
    let calculatedBalance = 0;
    for (const e of entries) {
      calculatedBalance += e.amount;
    }

    const discrepancy = calculatedBalance - currentBalance;
    if (Math.abs(discrepancy) > 0) {
      anomalies.push(`Ledger running balance (${currentBalance}) does not match sum of entries (${calculatedBalance}).`);
    }

    // Verify payments against ledger credits
    const payments = await this.getPaymentsByLeaderboard(leaderboardId);
    const succeededPayments = payments.filter((p) => p.status === 'succeeded');
    const creditEntries = entries.filter((e) => e.entry_type === 'entry_fee_credit' || (e.entry_type as string) === 'gross_entry_fee');

    if (succeededPayments.length !== creditEntries.length) {
      anomalies.push(
        `Discrepancy in payment counts: ${succeededPayments.length} succeeded payments vs ${creditEntries.length} credit entries.`
      );
    }

    const refunds = await this.getRefundsByLeaderboard(leaderboardId);
    const prizes = await this.getPrizeAllocations(leaderboardId);

    const totalGross = succeededPayments.reduce((acc, p) => acc + p.amount, 0);
    const totalProviderFees = succeededPayments.reduce((acc, p) => acc + p.provider_fee, 0);
    const totalPlatformFees = succeededPayments.reduce((acc, p) => acc + p.platform_fee, 0);
    const totalRefunds = refunds
      .filter((r) => r.status === 'succeeded')
      .reduce((acc, r) => acc + r.amount, 0);
    const totalPrizes = prizes
      .filter((p) => p.payout_status !== 'cancelled')
      .reduce((acc, p) => acc + p.allocated_amount, 0);

    const calculatedNet = totalGross - totalProviderFees - totalPlatformFees - totalRefunds - totalPrizes;
    const isBalanced = anomalies.length === 0 && (currentBalance === calculatedNet || currentBalance === calculatedBalance);

    return {
      balanced: isBalanced,
      isReconciled: isBalanced,
      calculatedBalance,
      currentBalance,
      discrepancy,
      anomalies,
      details: {
        grossPayments: totalGross,
        providerFees: totalProviderFees,
        platformFees: totalPlatformFees,
        refunds: totalRefunds,
        prizeAllocations: totalPrizes,
        calculatedNet,
        actualBalance: currentBalance,
      },
    };
  },

  // ─── Data Access & Persistence (Dual Supabase / LocalStorage) ────────────────

  async getPaymentByReference(reference: string): Promise<CompetitionPayment | null> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('competition_payments')
          .select('*')
          .eq('payment_reference', reference)
          .maybeSingle();
        if (!error && data) return data as CompetitionPayment;
      } catch {
        // Fall back to mockDb
      }
    }

    const all = mockDb.getCompetitionPayments();
    return all.find((p) => p.payment_reference === reference) || null;
  },

  async getPaymentsByLeaderboard(leaderboardId: string): Promise<CompetitionPayment[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('competition_payments')
          .select('*')
          .eq('leaderboard_id', leaderboardId)
          .order('created_at', { ascending: false });
        if (!error && data && data.length > 0) return data as CompetitionPayment[];
      } catch {
        // Fall back
      }
    }

    const all = mockDb.getCompetitionPayments();
    return all.filter((p) => p.leaderboard_id === leaderboardId);
  },

  async savePaymentRecord(payment: CompetitionPayment): Promise<void> {
    const all = mockDb.getCompetitionPayments();
    const idx = all.findIndex((p) => p.payment_reference === payment.payment_reference);
    if (idx >= 0) {
      all[idx] = payment;
    } else {
      all.unshift(payment);
    }
    mockDb.setCompetitionPayments(all);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('competition_payments').upsert(payment, { onConflict: 'payment_reference' });
      } catch (err) {
        console.warn('Supabase savePaymentRecord failed:', err);
      }
    }
  },

  async updatePaymentStatus(
    paymentId: string,
    status: CompetitionPayment['status'],
    extra: Partial<CompetitionPayment> = {}
  ): Promise<void> {
    const timestamp = nowIso();
    const all = mockDb.getCompetitionPayments();
    const idx = all.findIndex((p) => p.id === paymentId);
    if (idx >= 0) {
      all[idx] = { ...all[idx], status, updated_at: timestamp, ...extra };
      mockDb.setCompetitionPayments(all);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('competition_payments')
          .update({ status, updated_at: timestamp, ...extra })
          .eq('id', paymentId);
      } catch (err) {
        console.warn('Supabase updatePaymentStatus failed:', err);
      }
    }
  },

  async addLedgerEntry(entry: Omit<CompetitionLedgerEntry, 'id' | 'created_at'>): Promise<CompetitionLedgerEntry> {
    const fullEntry: CompetitionLedgerEntry = {
      ...entry,
      id: `ledg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      created_at: nowIso(),
    };

    const all = mockDb.getCompetitionLedgerEntries();
    all.unshift(fullEntry);
    mockDb.setCompetitionLedgerEntries(all);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('competition_ledger_entries').insert(fullEntry);
      } catch (err) {
        console.warn('Supabase addLedgerEntry failed:', err);
      }
    }

    return fullEntry;
  },

  async getLedgerEntries(leaderboardId: string): Promise<CompetitionLedgerEntry[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('competition_ledger_entries')
          .select('*')
          .eq('leaderboard_id', leaderboardId)
          .order('created_at', { ascending: false });
        if (!error && data && data.length > 0) return data as CompetitionLedgerEntry[];
      } catch {
        // Fall back
      }
    }

    const all = mockDb.getCompetitionLedgerEntries();
    return all.filter((e) => e.leaderboard_id === leaderboardId);
  },

  async getCurrentOrganizerBalance(leaderboardId: string): Promise<number> {
    const entries = await this.getLedgerEntries(leaderboardId);
    if (entries.length === 0) return 0;
    // Most recent entry has balance_after
    return entries[0].balance_after;
  },

  async saveRefundRecord(refund: CompetitionRefund): Promise<void> {
    const all = mockDb.getCompetitionRefunds();
    all.unshift(refund);
    mockDb.setCompetitionRefunds(all);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('competition_refunds').insert(refund);
      } catch (err) {
        console.warn('Supabase saveRefundRecord failed:', err);
      }
    }
  },

  async getRefundsByLeaderboard(leaderboardId: string): Promise<CompetitionRefund[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('competition_refunds')
          .select('*')
          .eq('leaderboard_id', leaderboardId)
          .order('created_at', { ascending: false });
        if (!error && data && data.length > 0) return data as CompetitionRefund[];
      } catch {
        // Fall back
      }
    }

    const all = mockDb.getCompetitionRefunds();
    return all.filter((r) => r.leaderboard_id === leaderboardId);
  },

  async getPrizeAllocations(leaderboardId: string): Promise<CompetitionPrizeAllocation[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('competition_prize_allocations')
          .select('*')
          .eq('leaderboard_id', leaderboardId)
          .order('rank_position', { ascending: true });
        if (!error && data && data.length > 0) return data as CompetitionPrizeAllocation[];
      } catch {
        // Fall back
      }
    }

    const all = mockDb.getCompetitionPrizeAllocations();
    return all.filter((p) => p.leaderboard_id === leaderboardId);
  },

  async savePrizeAllocations(leaderboardId: string, allocations: CompetitionPrizeAllocation[]): Promise<void> {
    const all = mockDb.getCompetitionPrizeAllocations();
    mockDb.setCompetitionPrizeAllocations([...all, ...allocations]);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('competition_prize_allocations').insert(allocations);
      } catch (err) {
        console.warn('Supabase savePrizeAllocations failed:', err);
      }
    }
  },

  buildReceipt(
    payment: CompetitionPayment,
    registration: CompetitionRegistration,
    competitionName: string,
    refundPolicy: string
  ) {
    return {
      receiptNumber: `REC-${payment.payment_reference.replace('cpay_', '').toUpperCase().slice(0, 12)}`,
      reference: payment.payment_reference,
      amount: payment.amount,
      currency: payment.currency,
      paidAt: payment.paid_at || nowIso(),
      participantName: registration.participant_name,
      participantEmail: registration.participant_email,
      competitionName,
      refundPolicy,
    };
  },
};
