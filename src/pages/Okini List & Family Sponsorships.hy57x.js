import wixData from 'wix-data';
import { session } from 'wix-storage';

// ====================================================================
// --- Configuration ---
const COLLECTIONS = {
    OPERATIONS: "Import3",
    FAMILIES: "Import4",
    INDIVIDUALS: "Import6",
    DONORS: "Import5"
};

const FIELDS = {
    OP_FAMILY_REF: "linkedFamily",
    OP_INDIVIDUAL_REF: "linkedIndividual",
    INDIVIDUAL_FAMILY_REF: "import_4_linked_family_members",
    OP_DONOR_REF: "linkedDonor",
    DONOR_OPS_REF: "Import3_linkedDonor",
    OKINI_TYPE: "whichOkini",
    COORDINATOR: "coordinator"
};

let checkoutSessionId;
// ====================================================================


$w.onReady(function () {
    initializePage();
});

async function initializePage() {
    initializeSession();
    await populateFamilyAndIndividualList();
    await populateSelectedRequestsRepeater();
    setupCheckoutForm();
}

function initializeSession() {
    let sessionId = session.getItem("checkoutSessionId");
    if (!sessionId) {
        sessionId = String(Date.now());
        session.setItem("checkoutSessionId", sessionId);
    }
    checkoutSessionId = sessionId;
    console.log(`User's Checkout Session ID: ${checkoutSessionId}`);
}

async function populateFamilyAndIndividualList() {
    console.log("Starting to build the REGULAR request list (Optimized)...");

    // 1. Fetch ALL active operations and INCLUDE the referenced families and individuals in ONE query
    const opsResult = await wixData.query(COLLECTIONS.OPERATIONS)
        .ne(FIELDS.OKINI_TYPE, "holiday")
        .include(FIELDS.OP_FAMILY_REF, FIELDS.OP_INDIVIDUAL_REF)
        .limit(1000) // Expand limit to ensure we get all records
        .find();

    const operations = opsResult.items;

    if (operations.length === 0) {
        console.log("No regular requests found.");
        $w('#repeater1').data = [];
        return;
    }

    // 2. Group the data by family in memory (Zero extra database calls)
    const familyMap = new Map();

    operations.forEach(op => {
        const family = op[FIELDS.OP_FAMILY_REF];
        if (!family) return; // Skip if no family is linked to this operation

        // If we haven't seen this family yet, create an entry for them
        if (!familyMap.has(family._id)) {
            familyMap.set(family._id, {
                familyDetails: family,
                familyRequest: null,
                individualItems: []
            });
        }

        const familyData = familyMap.get(family._id);

        // Sort the operation: Is it an individual request or a family request?
        if (op[FIELDS.OP_INDIVIDUAL_REF]) {
            const individual = op[FIELDS.OP_INDIVIDUAL_REF];
            
            // Push individual item (matching your original data structure)
            // We check to ensure we don't duplicate individuals if they have multiple requests
            if (!familyData.individualItems.find(item => item._id === individual._id)) {
                familyData.individualItems.push({
                    _id: individual._id,
                    type: 'individual',
                    data: { individual: individual, request: op }
                });
            }
        } else {
            // It's a general family request
            familyData.familyRequest = op;
        }
    });

    // 3. Flatten the grouped data into the list your repeater expects
    const flatList = [];
    familyMap.forEach((familyData, familyId) => {
        // Push the main family header
        flatList.push({
            _id: familyId,
            type: 'family',
            data: {
                familyDetails: familyData.familyDetails,
                familyRequest: familyData.familyRequest
            }
        });
        // Push all the individuals belonging to that family underneath them
        flatList.push(...familyData.individualItems);
    });

    console.log(`Populating main repeater (#repeater1) with ${flatList.length} total regular items.`);
    
    // 4. Bind the data to the repeater
    const repeater = $w('#repeater1');
    repeater.data = flatList;

    // --- YOUR EXISTING onItemReady LOGIC STAYS EXACTLY THE SAME BELOW ---
    repeater.onItemReady(($item, item, index) => {
        const requestInfoTextElement = $item('#requestInfoText');
        const contactTextElement = $item('#text148'); 
        let htmlString = "";
        let requestData = null; 

        switch (item.type) {
            case 'family':
                const { familyDetails, familyRequest } = item.data;
                requestData = familyRequest; 
                htmlString = `<p style="font-size:18px;"><strong>${familyDetails.headOfFamily}'s Family</strong></p>
                              <p style="clear: both;"><strong>About:</strong> ${familyDetails.familyDescription || 'N/A'}</p>`;
                if (familyRequest) {
                    htmlString += `<p style="margin-left: 20px;"><strong>Family Need:</strong> ${familyRequest.requestDonationDetails || 'N/A'}</p>`;
                    configureSwitchAndUrgentBox($item, familyRequest);
                } else {
                    $item('#switch1').collapse();
                    $item('#box172').collapse();
                }
                break;

            case 'individual':
                const { individual, request } = item.data;
                requestData = request; 
                htmlString = `<p style="margin-left: 40px;"><strong>${individual.boyOrGirl || 'Member'}, Age: ${individual.age || ''}</strong><br><strong>Needs:</strong> ${request.requestDonationDetails || 'N/A'}<br><strong>Sizes:</strong> ${request.sizeDetails || 'N/A'}</p>`;
                configureSwitchAndUrgentBox($item, request);
                break;
        }

        const coordinatorName = requestData ? requestData[FIELDS.COORDINATOR] : null;

        if (coordinatorName) {
            contactTextElement.text = `Contact: ${coordinatorName}`;
            contactTextElement.expand(); 
        } else {
            contactTextElement.text = ""; 
            contactTextElement.collapse(); 
        }
    });
}

function configureSwitchAndUrgentBox($item, requestData) {
    const isUrgent = requestData.urgentNeedStatus === true || String(requestData.urgentNeedStatus).toUpperCase() === 'TRUE';
    if (isUrgent) { $item('#box172').expand(); }
    else { $item('#box172').collapse(); }

    const switchElement = $item('#switch1');
    switchElement.expand();
    switchElement.checked = (requestData.checkoutSessionId === checkoutSessionId);

    switchElement.onChange(async () => {
        const newSessionId = switchElement.checked ? checkoutSessionId : null;
        await wixData.save(COLLECTIONS.OPERATIONS, { ...requestData, checkoutSessionId: newSessionId });
        await populateSelectedRequestsRepeater();
    });
}

async function populateSelectedRequestsRepeater() {
    const selectedOps = await wixData.query(COLLECTIONS.OPERATIONS)
        .eq("checkoutSessionId", checkoutSessionId)
        .ne(FIELDS.OKINI_TYPE, "holiday")
        .find();

    $w('#repeater2').data = selectedOps.items;

    $w('#repeater2').onItemReady(($item, itemData, index) => {
        $item('#button19').onClick(async () => {
            await wixData.save(COLLECTIONS.OPERATIONS, { ...itemData, checkoutSessionId: null });
            await populateFamilyAndIndividualList();
            await populateSelectedRequestsRepeater();
        });
    });
}

function setupCheckoutForm() {
    const submitButton = $w('#button20');

    // --- FIX 1: Disable the button by default ---
    submitButton.disable(); 

    // --- FIX 2: Add listeners to your inputs ---
    // These will call the validation function on every change
    $w('#input1').onInput(validateCheckoutForm);
    $w('#checkboxGroup1').onChange(validateCheckoutForm);
    // If you also want to validate #input2 or #input3, add them here:
    // $w('#input2').onInput(validateCheckoutForm); 
    // $w('#input3').onInput(validateCheckoutForm); 

    // --- FIX 3: Run validation once on page load ---
    // This sets the initial state (which will be disabled)
    validateCheckoutForm();

    // Your existing onClick logic stays the same
    submitButton.onClick(async () => {
        submitButton.disable();
        submitButton.label = "Processing...";

        try {
            // ... (rest of your submit logic) ...
            
            submitButton.label = "Success!";

        } catch (err) {
            console.error("Checkout failed:", err);
            submitButton.label = "Error - Please Try Again";
            // Re-enable button on error
            submitButton.enable(); 
            // OR better, re-run validation
            // validateCheckoutForm();
        }
    });
}

/**
 * Checks if the form is valid and enables/disables the submit button.
 */
function validateCheckoutForm() {
    // Assumes #input1 (Email) and #input3 (Name) are set as 'Required' in the Editor.
    // If you also want the phone (#input2) to be required, add '&& $w('#input2').valid'
    const isDonorInfoValid = $w('#input1').valid && $w('#checkboxGroup1').valid;


    // Enable button ONLY if both conditions are true
    if (isDonorInfoValid) {
        $w('#button20').enable();
    } else {
        $w('#button20').disable();
    }
}