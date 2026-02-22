import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script to cleanup and align workflow step configurations with the new integrated workflow structure
 *
 * New structure has 5 fixed steps:
 * 1. application_created - Application créée
 * 2. credit_analysis - Analyse crédit & Évaluation risques (combines old document_verification, financial_analysis, risk_assessment)
 * 3. final_decision - Décision finale
 * 4. contract_preparation - Préparation contrat
 * 5. disbursement - Déblocage fonds
 *
 * Plus dynamic approval steps based on credit amount (managed by ApprovalLimits)
 */

async function cleanupWorkflowSteps() {
  console.log('🧹 Starting workflow steps cleanup...\n');

  try {
    // Step 1: Delete old/redundant workflow step configurations
    console.log('Step 1: Removing old workflow step configurations...');

    const oldSteps = [
      'document_verification',
      'financial_analysis',
      'risk_assessment',
      'branch_manager_review',
      'credit_committee_review',
      'management_review',
      'Vérification Documents',
      'Analyse Crédit',
      'Évaluation Risques',
      'Examen Directeur Agence',
      'Examen Comité Crédit',
      'Examen Direction',
      'Décision Finale',
      'Préparation Contrat',
      'Déblocage Fonds'
    ];

    for (const stepName of oldSteps) {
      const deleted = await prisma.workflowStepConfig.deleteMany({
        where: { stepName }
      });
      if (deleted.count > 0) {
        console.log(`  ✓ Deleted ${deleted.count} config(s) for "${stepName}"`);
      }
    }

    // Step 2: Create/update the 5 fixed workflow step configurations
    console.log('\nStep 2: Creating fixed workflow step configurations...');

    const fixedSteps = [
      {
        stepName: 'application_created',
        displayName: 'Application Créée',
        description: 'Demande de crédit soumise et enregistrée dans le système',
        expectedDuration: 0, // Instantaneous
        maxDuration: 0,
        stepType: 'FIXED' as const,
        isActive: true
      },
      {
        stepName: 'credit_analysis',
        displayName: 'Analyse Crédit & Évaluation Risques',
        description: 'Vérification des documents, analyse financière et évaluation des risques',
        expectedDuration: 1440, // 3 days (3 * 480 minutes per day)
        maxDuration: 2400, // 5 days maximum
        stepType: 'FIXED' as const,
        isActive: true
      },
      {
        stepName: 'final_decision',
        displayName: 'Décision Finale',
        description: 'Décision finale sur l\'approbation ou le rejet de la demande',
        expectedDuration: 480, // 1 day
        maxDuration: 960, // 2 days maximum
        stepType: 'FIXED' as const,
        isActive: true
      },
      {
        stepName: 'contract_preparation',
        displayName: 'Préparation Contrat',
        description: 'Préparation et signature du contrat de crédit',
        expectedDuration: 960, // 2 days
        maxDuration: 1440, // 3 days maximum
        stepType: 'FIXED' as const,
        isActive: true
      },
      {
        stepName: 'disbursement',
        displayName: 'Déblocage Fonds',
        description: 'Déblocage et transfert des fonds au client',
        expectedDuration: 480, // 1 day
        maxDuration: 960, // 2 days maximum
        stepType: 'FIXED' as const,
        isActive: true
      }
    ];

    for (const step of fixedSteps) {
      const result = await prisma.workflowStepConfig.upsert({
        where: { stepName: step.stepName },
        update: {
          displayName: step.displayName,
          description: step.description,
          expectedDuration: step.expectedDuration,
          maxDuration: step.maxDuration,
          stepType: step.stepType,
          isActive: step.isActive
        },
        create: step
      });
      console.log(`  ✓ ${result.displayName} (${result.stepName})`);
    }

    // Step 3: Ensure approval limits are properly configured
    console.log('\nStep 3: Verifying approval limits configuration...');

    const approvalLimits = await prisma.approvalLimit.findMany({
      orderBy: { minAmount: 'asc' }
    });

    if (approvalLimits.length === 0) {
      console.log('  ⚠️  No approval limits found. Creating default configuration...');

      const defaultLimits = [
        {
          role: 'BRANCH_MANAGER' as const,
          displayName: 'Directeur d\'Agence',
          minAmount: 0,
          maxAmount: 10000000, // 10M XOF
          currency: 'XOF',
          reviewDuration: 480, // 1 day
          maxReviewDuration: 960, // 2 days
          description: 'Montants jusqu\'à 10M XOF'
        },
        {
          role: 'CREDIT_COMMITTEE' as const,
          displayName: 'Comité de Crédit',
          minAmount: 10000000,
          maxAmount: 50000000, // 50M XOF
          currency: 'XOF',
          reviewDuration: 960, // 2 days
          maxReviewDuration: 1920, // 4 days
          description: 'Montants de 10M à 50M XOF'
        },
        {
          role: 'MANAGEMENT' as const,
          displayName: 'Direction Générale',
          minAmount: 50000000,
          maxAmount: 999999999999, // No practical limit
          currency: 'XOF',
          reviewDuration: 1440, // 3 days
          maxReviewDuration: 2880, // 6 days
          description: 'Montants supérieurs à 50M XOF'
        }
      ];

      for (const limit of defaultLimits) {
        await prisma.approvalLimit.create({
          data: limit
        });
        console.log(`  ✓ Created approval limit for ${limit.displayName}`);
      }
    } else {
      console.log(`  ✓ Found ${approvalLimits.length} approval limit(s) configured`);
      approvalLimits.forEach(limit => {
        console.log(`    - ${limit.displayName}: ${limit.minAmount.toString()} - ${limit.maxAmount.toString()} ${limit.currency}`);
      });
    }

    console.log('\n✅ Workflow steps cleanup completed successfully!\n');
    console.log('📋 Summary:');
    console.log(`   - Fixed workflow steps: 5`);
    console.log(`   - Approval limits configured: ${approvalLimits.length || 3}`);
    console.log(`   - Old/redundant steps removed`);
    console.log('\n💡 Note: Approval steps are now dynamically generated based on credit amount');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanupWorkflowSteps()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
