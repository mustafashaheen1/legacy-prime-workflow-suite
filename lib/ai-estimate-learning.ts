import { SubcontractorProposal } from '@/types';

export interface EstimateInsight {
  averageRate: number;
  tradeComparison: {
    trade: string;
    averageAmount: number;
    count: number;
  }[];
  priceRange: {
    min: number;
    max: number;
    median: number;
  };
  recommendation: string;
}

export class AIEstimateLearning {
  private proposals: SubcontractorProposal[] = [];

  trackProposal(proposal: SubcontractorProposal) {
    this.proposals.push(proposal);
    console.log('[AI Learning] Tracked new proposal:', proposal.id);
    console.log('[AI Learning] Total proposals tracked:', this.proposals.length);
  }

  getInsightsForProject(projectId: string): EstimateInsight | null {
    const projectProposals = this.proposals.filter(p => p.projectId === projectId);

    if (projectProposals.length === 0) {
      console.log('[AI Learning] No proposals found for project:', projectId);
      return null;
    }

    const amounts = projectProposals.map(p => p.amount).sort((a, b) => a - b);
    const averageRate = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
    const median = amounts.length % 2 === 0
      ? (amounts[amounts.length / 2 - 1] + amounts[amounts.length / 2]) / 2
      : amounts[Math.floor(amounts.length / 2)];

    const tradeGroups: { [trade: string]: number[] } = {};
    projectProposals.forEach(p => {
      if (!tradeGroups[p.subcontractorId]) {
        tradeGroups[p.subcontractorId] = [];
      }
      tradeGroups[p.subcontractorId].push(p.amount);
    });

    const tradeComparison = Object.keys(tradeGroups).map(trade => ({
      trade,
      averageAmount: tradeGroups[trade].reduce((sum, amt) => sum + amt, 0) / tradeGroups[trade].length,
      count: tradeGroups[trade].length,
    }));

    let recommendation = '';
    if (amounts.length >= 3) {
      const lowestAmount = amounts[0];
      const highestAmount = amounts[amounts.length - 1];
      const priceVariance = ((highestAmount - lowestAmount) / lowestAmount) * 100;

      if (priceVariance > 30) {
        recommendation = `High price variance detected (${priceVariance.toFixed(1)}%). Consider requesting detailed breakdowns from all subcontractors to understand the differences.`;
      } else if (priceVariance < 10) {
        recommendation = `Prices are closely aligned (${priceVariance.toFixed(1)}% variance). Consider other factors like timeline, quality, and past performance when selecting.`;
      } else {
        recommendation = `Moderate price variance (${priceVariance.toFixed(1)}%). The median estimate of $${median.toFixed(2)} may be a good benchmark for negotiations.`;
      }
    } else {
      recommendation = 'Collect more estimates (at least 3) for better comparison and insights.';
    }

    console.log('[AI Learning] Generated insights for project:', projectId);

    return {
      averageRate,
      tradeComparison,
      priceRange: {
        min: amounts[0],
        max: amounts[amounts.length - 1],
        median,
      },
      recommendation,
    };
  }

  getBudgetSuggestion(projectType: string, scope: string): string {
    console.log('[AI Learning] Generating budget suggestion for:', projectType, scope);
    
    const relevantProposals = this.proposals.filter(p => 
      p.description.toLowerCase().includes(projectType.toLowerCase()) ||
      p.description.toLowerCase().includes(scope.toLowerCase())
    );

    if (relevantProposals.length === 0) {
      return `No historical data available for ${projectType}. Consider requesting estimates from multiple subcontractors to establish a baseline.`;
    }

    const amounts = relevantProposals.map(p => p.amount).sort((a, b) => a - b);
    const average = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
    const min = amounts[0];
    const max = amounts[amounts.length - 1];

    return `Based on ${amounts.length} similar projects, typical costs range from $${min.toFixed(2)} to $${max.toFixed(2)}, with an average of $${average.toFixed(2)}.`;
  }
}

export const aiEstimateLearning = new AIEstimateLearning();
