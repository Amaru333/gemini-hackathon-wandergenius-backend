import express from 'express';
import prisma from '../lib/prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get budget stats and details for a trip
router.get('/:tripId', authenticateToken, async (req, res) => {
  try {
    const { tripId } = req.params;

    // First check if user owns the trip
    const plannedTrip = await prisma.plannedTrip.findUnique({
      where: { id: tripId },
      include: { budget: true }
    });

    if (!plannedTrip) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    if (plannedTrip.userId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized to view this budget' });
    }

    // Get stats
    const budget = await prisma.tripBudget.findFirst({
      where: { tripId },
      include: {
        participants: true,
        expenses: {
          include: {
            paidBy: true
          },
          orderBy: {
            date: 'desc'
          }
        }
      }
    });

    if (!budget) {
      return res.json({ notSetup: true });
    }

    // Calculate debts (simplified algorithm)
    // 1. Calculate net balance for each participant
    // positive = paid more than share (owed money)
    // negative = paid less than share (owes money)
    const balances = {};
    budget.participants.forEach(p => {
      balances[p.id] = { name: p.name, amount: 0 };
    });

    budget.expenses.forEach(expense => {
      const payerId = expense.paidById;
      const amount = expense.amount;
      const splitBetween = expense.splitWithIds;
      
      if (splitBetween.length > 0) {
        const splitAmount = amount / splitBetween.length;
        
        // Payer gets credit for the full amount
        if (balances[payerId]) {
          balances[payerId].amount += amount;
        }

        // Everyone involved debited their share
        splitBetween.forEach(id => {
          if (balances[id]) {
            balances[id].amount -= splitAmount;
          }
        });
      }
    });

    // 2. Resolve debts
    const debts = [];
    const debtors = [];
    const creditors = [];

    Object.entries(balances).forEach(([id, data]) => {
      // Small threshold for floating point errors
      if (data.amount < -0.01) debtors.push({ id, name: data.name, amount: data.amount });
      if (data.amount > 0.01) creditors.push({ id, name: data.name, amount: data.amount });
    });

    debtors.sort((a, b) => a.amount - b.amount); // Ascending (most negative first)
    creditors.sort((a, b) => b.amount - a.amount); // Descending (most positive first)

    let i = 0; // debtor index
    let j = 0; // creditor index

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      
      const amount = Math.min(Math.abs(debtor.amount), creditor.amount);
      
      if (amount > 0.01) {
        debts.push({
          from: debtor.name,
          to: creditor.name,
          amount: Number(amount.toFixed(2))
        });
      }

      debtor.amount += amount;
      creditor.amount -= amount;

      if (Math.abs(debtor.amount) < 0.01) i++;
      if (creditor.amount < 0.01) j++;
    }

    // Calculate total spent
    const totalSpent = budget.expenses.reduce((sum, e) => sum + e.amount, 0);

    res.json({
      ...budget,
      totalSpent,
      remaining: budget.totalBudget - totalSpent,
      debts
    });

  } catch (error) {
    console.error('Get budget error:', error);
    res.status(500).json({ error: 'Failed to fetch budget' });
  }
});

// Setup budget for a trip
router.post('/:tripId/setup', authenticateToken, async (req, res) => {
  try {
    const { tripId } = req.params;
    const { totalBudget, currency, participants } = req.body;

    // Verify ownership
    const trip = await prisma.plannedTrip.findUnique({
      where: { id: tripId }
    });

    if (!trip || trip.userId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Create budget and participants transactionally
    const result = await prisma.$transaction(async (tx) => {
      const budget = await tx.tripBudget.create({
        data: {
          tripId,
          totalBudget: parseFloat(totalBudget),
          currency: currency || 'USD'
        }
      });

      // Add participants (always include "Me")
      const names = [...new Set(['Me', ...participants])];
      
      await tx.tripParticipant.createMany({
        data: names.map(name => ({
          budgetId: budget.id,
          name
        }))
      });

      return budget;
    });

    res.json(result);
  } catch (error) {
    console.error('Setup budget error:', error);
    res.status(500).json({ error: 'Failed to setup budget' });
  }
});

// Add expense
router.post('/:tripId/expense', authenticateToken, async (req, res) => {
  try {
    const { tripId } = req.params;
    const { amount, category, description, paidById, splitWithIds } = req.body;

    // Get budget id
    const budget = await prisma.tripBudget.findFirst({
      where: { tripId },
      include: { participants: true } // Need participants to validate IDs
    });

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    const expense = await prisma.expense.create({
      data: {
        budgetId: budget.id,
        amount: parseFloat(amount),
        category,
        description,
        paidById,
        splitWithIds, // Array of participant IDs
        date: new Date()
      },
      include: {
        paidBy: true
      }
    });

    res.json(expense);
  } catch (error) {
    console.error('Add expense error:', error);
    res.status(500).json({ error: 'Failed to add expense' });
  }
});

// Delete expense
router.delete('/:tripId/expense/:expenseId', authenticateToken, async (req, res) => {
  try {
    const { expenseId } = req.params;
    
    await prisma.expense.delete({
      where: { id: expenseId }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

export default router;
