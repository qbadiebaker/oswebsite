import wixData from 'wix-data';

// Keep track of the family we want to link (whether existing or freshly created)
let selectedFamily = null; 

$w.onReady(function () {

    // ==========================================
    // 1. SEARCH EXISTING FAMILIES
    // ==========================================
    $w('#input3').onInput(() => {
        let keyword = $w('#input3').value;
        $w('#existingFamiliesDataset').setFilter(
            wixData.filter().contains('headOfFamily', keyword)
            // Note: You can chain .or().contains() if you want to search by other fields
        );
    });

    // ==========================================
    // 2. UI TOGGLES (Add Existing vs Add New)
    // ==========================================
    $w('#addExistingFamily').onClick(() => {
        $w('#familySearchTable').expand();
        $w('#box248').collapse(); // Hide the new family form
    });

    $w('#addNewFamily').onClick(() => {
        $w('#box248').expand();
        $w('#familySearchTable').collapse(); // Hide the search table
    });

    // ==========================================
    // 3. LINK AN EXISTING FAMILY
    // ==========================================
    $w('#familySearchTable').onRowSelect((event) => {
        selectedFamily = event.rowData; // Grab the data of the clicked row
        updateRepeaterUI();
        $w('#familySearchTable').collapse(); 
    });

    // ==========================================
    // 4. REMOVE LINKED FAMILY
    // ==========================================
    $w('#removeLinkedFamilyButton').onClick(() => {
        selectedFamily = null;
        updateRepeaterUI();
    });

    // ==========================================
    // 5. SAVE & LINK A NEW FAMILY (Inside Box 248)
    // ==========================================
    $w('#saveButton').onClick(async () => {
        // Construct the new family object
        // NOTE: Replace the right-side values with your actual input IDs inside box248
        let newFamilyData = {
            headOfFamily: $w('#headOffamilyInput').value, 
            familyDescription: $w('#familyDescriptionInput').value,
            staffNotes: $w('#staffNotes').value,
            primaryMailingAddress: $w('#primaryMailingAddressInput').value,
            phone: $w('#phone').value,
            directionsPhysicalLocation: $w('#directionsOrPhysAddress').value,
            email: $w('#email').value,
            // Add any other fields you need here
        };

        try {
            // Insert into the Families collection (Change 'Import4' to actual collection ID if different)
            let insertedFamily = await wixData.insert('Import4', newFamilyData); 
            
            selectedFamily = insertedFamily; // Set as the currently selected family
            updateRepeaterUI();
            
            $w('#box248').collapse(); // Hide the form upon success
        } catch (error) {
            console.error("Failed to create new family:", error);
        }
    });

    // ==========================================
    // 6. FINAL SAVE: CREATE OPERATION & ESTABLISH LINK
    // ==========================================
    $w('#button28').onClick(async () => {
        // Validate that an operation description exists
        if (!$w('#input2').value) return console.error("Req title is required");

        let newOperationData = {
            requestDonationDetails: $w('#input2').value, // Req title
            forWho: $w('#input5').value,                 // For Who?
            requestNotes: $w('#input1').value,           // Req description
            operationType: "Request",                    // Defaulting operation type
            dateRequested: new Date()
        };

        // If 'linkedFamily' is a standard Reference Field, you can attach it directly upon insert:
        if (selectedFamily) {
             newOperationData.linkedFamily = selectedFamily._id; 
        }

        try {
            // Insert into Operations collection ('Import3')
            let insertedOp = await wixData.insert('Import3', newOperationData);

            if (selectedFamily) {
                await wixData.insertReference('Import3', 'linkedFamily', insertedOp._id, selectedFamily._id);
             }

            console.log("Operation successfully created and linked!");
            // Optional: Add logic here to clear the form or show a success message to the admin.

        } catch (error) {
            console.error("Failed to create Operation:", error);
        }
    });

    // ==========================================
    // HELPER FUNCTIONS
    // ==========================================

    // Feeds data to the repeater or hides it if no family is selected
    function updateRepeaterUI() {
        if (selectedFamily) {
            $w('#linkedFamilyRepeater').data = [selectedFamily]; // Repeaters always expect an array
            $w('#linkedFamilyRepeater').expand();
        } else {
            $w('#linkedFamilyRepeater').data = [];
            $w('#linkedFamilyRepeater').collapse();
        }
    }

    // Maps the data to the specific text elements inside the repeater
    $w('#linkedFamilyRepeater').onItemReady(($item, itemData) => {
        $item('#linkedFamilyHead').text = itemData.headOfFamily || "N/A";
        $item('#linkedFamilyStaffNotes').text = itemData.staffNotes || "No staff notes available.";
        $item('#linkedFamilyComposition').text = itemData.familyDescription || "N/A";
    });

});