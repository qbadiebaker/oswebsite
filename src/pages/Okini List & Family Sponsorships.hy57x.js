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
    console.log("Starting to build the REGULAR request list (Memory Match)...");

    try {
        // 1. Fetch all relevant data concurrently (Limits ensure we get enough items)
        const [opsResult, familiesResult, individualsResult] = await Promise.all([
            wixData.query(COLLECTIONS.OPERATIONS).ne(FIELDS.OKINI_TYPE, "holiday").limit(1000).find(),
            wixData.query(COLLECTIONS.FAMILIES).limit(1000).find(),
            wixData.query(COLLECTIONS.INDIVIDUALS).limit(1000).find()
        ]);

        const operations = opsResult.items;
        const families = familiesResult.items;
        const individuals = individualsResult.items;

        if (families.length === 0) {
            console.log("No families found.");
            $w('#repeater1').data = [];
            return;
        }

        const flatList = [];

        // Helper function: Safely checks if a database field matches an ID
        // (Handles both single strings and arrays of strings)
        const matchesId = (fieldValue, targetId) => {
            if (!fieldValue) return false;
            if (Array.isArray(fieldValue)) return fieldValue.includes(targetId);
            return fieldValue === targetId;
        };

        // 2. Loop through families and match up the requests locally
        for (const family of families) {
            
            // Find operations linked to this family that DO NOT have an individual linked
            const familyRequests = operations.filter(op => {
                const matchesFam = matchesId(op[FIELDS.OP_FAMILY_REF], family._id);
                const indRef = op[FIELDS.OP_INDIVIDUAL_REF];
                const isEmptyInd = !indRef || (Array.isArray(indRef) && indRef.length === 0);
                return matchesFam && isEmptyInd;
            });

            // Find individuals belonging to this family
            const familyIndividuals = individuals.filter(ind => 
                matchesId(ind[FIELDS.INDIVIDUAL_FAMILY_REF], family._id)
            );

            let hasAnyRegularRequests = familyRequests.length > 0;
            const individualItems = [];

            // Check operations for each individual
            for (const individual of familyIndividuals) {
                const indRequests = operations.filter(op => 
                    matchesId(op[FIELDS.OP_INDIVIDUAL_REF], individual._id)
                );

                if (indRequests.length > 0) {
                    hasAnyRegularRequests = true;
                    individualItems.push({
                        _id: individual._id,
                        type: 'individual',
                        data: { individual: individual, request: indRequests[0] }
                    });
                }
            }

            // Only push to repeater if there is an active request
            if (hasAnyRegularRequests) {
                flatList.push({
                    _id: family._id,
                    type: 'family',
                    data: {
                        familyDetails: family,
                        familyRequest: familyRequests.length > 0 ? familyRequests[0] : null
                    }
                });
                flatList.push(...individualItems);
            }
        }

        console.log(`Populating main repeater (#repeater1) with ${flatList.length} total regular items.`);
        const repeater = $w('#repeater1');
        repeater.data = flatList;

        // --- Handle UI elements inside Repeater 1 ---
        repeater.onItemReady(($item, item, index) => {
            const requestInfoTextElement = $item('#requestInfoText');
            const contactTextElement = $item('#text148'); 
            let htmlString = "";
            let requestData = null; 

            switch (item.type) {
                case 'family':
                    const { familyDetails, familyRequest } = item.data;
                    requestData = familyRequest; 
                    
                    htmlString = `<p style="font-size:18px;"><strong>${familyDetails.headOfFamily || 'Family'}'s Family</strong></p>
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

    } catch (err) {
        console.error("Error populating request list:", err);
    }
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
    validateCheckoutForm();

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
        }
    });
}

/**
 * Checks if the form is valid and enables/disables the submit button.
 */
function validateCheckoutForm() {
    // Assumes #input1 (Email) and #input3 (Name) are set as 'Required' in the Editor.
    const isDonorInfoValid = $w('#input1').valid && $w('#checkboxGroup1').valid;

    if (isDonorInfoValid) {
        $w('#button20').enable();
    } else {
        $w('#button20').disable();
    }
}