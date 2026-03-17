import wixData from 'wix-data';

// ====================================================================
// --- Configuration ---
const DONORS_COLLECTION_ID = "Import5"; 
const APPROVAL_FIELD_KEY = "approvedDonor";
// ====================================================================


$w.onReady(function () {
    updateNewDonorCount();
});


/**
 * Queries the Donors collection to count unapproved items and updates the text element.
 */
async function updateNewDonorCount() {
    const countElement = $w('#text127'); 

    try {
        const count = await wixData.query(DONORS_COLLECTION_ID)
            .ne(APPROVAL_FIELD_KEY, true)
            .count();

        if (count === 1) {
            countElement.text = "There is 1 donor pending approval";
        } else {
            countElement.text = `There are ${count} donors pending approval`;
        }

    } catch (error) {
        console.error("Failed to count new donors:", error);
        countElement.text = "Error loading donor count.";
    }
}