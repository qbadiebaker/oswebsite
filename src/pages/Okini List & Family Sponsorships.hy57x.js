import wixData from 'wix-data';
import { session } from 'wix-storage';

// ====================================================================
// --- Configuration ---
const COLLECTIONS = {
    OPERATIONS: "Import3",
    FAMILIES: "Import4",
    INDIVIDUALS: "Import6"
};

const FIELDS = {
    OP_FAMILY_REF: "linkedFamily",
    OP_INDIVIDUAL_REF: "linkedIndividual",
    INDIVIDUAL_FAMILY_REF: "import_4_linked_family_members",
    OKINI_TYPE: "whichOkini",
    COORDINATOR: "coordinator"
};

let checkoutSessionId;
// ====================================================================

$w.onReady(function () {
    initializeSession();
    setupRepeaters(); 
    setupCheckoutForm();
    
    populateFamilyAndIndividualList();
    populateSelectedRequestsRepeater();
});

function initializeSession() {
    let sessionId = session.getItem("checkoutSessionId");
    if (!sessionId) {
        sessionId = String(Date.now());
        session.setItem("checkoutSessionId", sessionId);
    }
    checkoutSessionId = sessionId;
}

// ====================================================================
// --- UI Setup & Event Listeners ---
// ====================================================================
function setupRepeaters() {
    $w('#repeater1').onItemReady(($item, itemData) => {
        const requestInfoTextElement = $item('#requestInfoText');
        const contactTextElement = $item('#text148'); 
        let htmlString = "";
        let requestData = null; 

        // 1. Build Text Info based on type
        if (itemData.type === 'family') {
            const familyDetails = itemData.data.familyDetails;
            requestData = itemData.data.familyRequest;
            htmlString = `<p style="font-size:18px;"><strong>${familyDetails.headOfFamily || 'Family'}'s Family</strong></p>
                          <p style="clear: both;"><strong>About:</strong> ${familyDetails.familyDescription || 'N/A'}</p>`;
            if (requestData) {
                htmlString += `<p style="margin-left: 20px;"><strong>Family Need:</strong> ${requestData.requestDonationDetails || 'N/A'}</p>`;
            }
        } else if (itemData.type === 'individual') {
            const individual = itemData.data.individual;
            requestData = itemData.data.request;
            htmlString = `<p style="margin-left: 40px;"><strong>${individual.boyOrGirl || 'Member'}, Age: ${individual.age || ''}</strong><br><strong>Needs:</strong> ${requestData.requestDonationDetails || 'N/A'}<br><strong>Sizes:</strong> ${requestData.sizeDetails || 'N/A'}</p>`;
        }

        requestInfoTextElement.html = htmlString;

        // 2. Format Contact Info
        if (requestData && requestData[FIELDS.COORDINATOR]) {
            contactTextElement.text = `Contact: ${requestData[FIELDS.COORDINATOR]}`;
            contactTextElement.expand(); 
        } else {
            contactTextElement.collapse(); 
        }

        // 3. Configure Switch & Urgent Box
        if (requestData) {
            const isUrgent = requestData.urgentNeedStatus === true || String(requestData.urgentNeedStatus).toUpperCase() === 'TRUE';
            if (isUrgent) $item('#box172').expand(); else $item('#box172').collapse();

            const switchElement = $item('#switch1');
            switchElement.expand();
            switchElement.checked = (requestData.checkoutSessionId === checkoutSessionId);

            switchElement.onChange(async (event) => {
                switchElement.disable(); // Prevent rapid clicks
                const isChecked = switchElement.checked;
                const newSessionId = isChecked ? checkoutSessionId : null;
                
                // CRITICAL FIX: event.context.itemId guarantees we get the correct row ID, avoiding the closure bug.
                const correctOperationId = event.context.itemId; 

                try {
                    const rawItem = await wixData.get(COLLECTIONS.OPERATIONS, correctOperationId);
                    rawItem.checkoutSessionId = newSessionId;
                    await wixData.update(COLLECTIONS.OPERATIONS, rawItem);
                    
                    await populateSelectedRequestsRepeater();
                } catch (error) {
                    console.error("Failed to update selection:", error);
                    switchElement.checked = !isChecked; // Revert visually on fail
                } finally {
                    switchElement.enable();
                }
            });
        } else {
            $item('#switch1').collapse();
            $item('#box172').collapse();
        }
    });

    $w('#repeater2').onItemReady(($item, itemData) => {
        $item('#button19').onClick(async (event) => {
            $item('#button19').disable();
            try {
                const correctOperationId = event.context.itemId;
                const rawItem = await wixData.get(COLLECTIONS.OPERATIONS, correctOperationId);
                rawItem.checkoutSessionId = null;
                await wixData.update(COLLECTIONS.OPERATIONS, rawItem);
                
                await populateSelectedRequestsRepeater();
                await populateFamilyAndIndividualList(); // Refresh main list to un-check the switch
            } catch (error) {
                console.error("Failed to remove item:", error);
                $item('#button19').enable();
            }
        });
    });
}

// ====================================================================
// --- Parallel Data Fetching (Fast & Accurate) ---
// ====================================================================
async function populateFamilyAndIndividualList() {
    try {
        const familiesResult = await wixData.query(COLLECTIONS.FAMILIES).limit(1000).find();
        const families = familiesResult.items;

        if (families.length === 0) {
            $w('#repeater1').data = [];
            return;
        }

        const flatList = [];
        const chunkSize = 50; // Process 50 families at a time to prevent Wix API timeouts

        for (let i = 0; i < families.length; i += chunkSize) {
            const chunk = families.slice(i, i + chunkSize);

            const chunkPromises = chunk.map(async (family) => {
                const familyItems = [];

                // Fetch requests concurrently
                const [familyRequestsResult, individualsResult] = await Promise.all([
                    wixData.query(COLLECTIONS.OPERATIONS).hasSome(FIELDS.OP_FAMILY_REF, family._id).isEmpty(FIELDS.OP_INDIVIDUAL_REF).ne(FIELDS.OKINI_TYPE, "holiday").find(),
                    wixData.query(COLLECTIONS.INDIVIDUALS).hasSome(FIELDS.INDIVIDUAL_FAMILY_REF, family._id).find()
                ]);

                const familyRequests = familyRequestsResult.items;
                const individuals = individualsResult.items;

                let hasAnyRegularRequests = familyRequests.length > 0;
                const individualItems = [];

                if (individuals.length > 0) {
                    const indPromises = individuals.map(async (individual) => {
                        const indReqQuery = await wixData.query(COLLECTIONS.OPERATIONS)
                            .hasSome(FIELDS.OP_INDIVIDUAL_REF, individual._id)
                            .ne(FIELDS.OKINI_TYPE, "holiday").find();

                        if (indReqQuery.items.length > 0) {
                            individualItems.push({
                                _id: indReqQuery.items[0]._id, // STRICT ID BINDING
                                type: 'individual',
                                data: { individual, request: indReqQuery.items[0] }
                            });
                        }
                    });
                    await Promise.all(indPromises);
                    if (individualItems.length > 0) hasAnyRegularRequests = true;
                }

                if (hasAnyRegularRequests) {
                    const famReq = familyRequests.length > 0 ? familyRequests[0] : null;
                    familyItems.push({
                        _id: famReq ? famReq._id : `fam_${family._id}`, // STRICT ID BINDING
                        type: 'family',
                        data: { familyDetails: family, familyRequest: famReq }
                    });
                    familyItems.push(...individualItems);
                }
                return familyItems;
            });

            // Wait for chunk to finish and push to flat list
            const chunkResults = await Promise.all(chunkPromises);
            chunkResults.forEach(items => flatList.push(...items));
        }

        $w('#repeater1').data = flatList;

    } catch (err) {
        console.error("Error populating request list:", err);
    }
}

async function populateSelectedRequestsRepeater() {
    if (!checkoutSessionId) return;

    try {
        const selectedOps = await wixData.query(COLLECTIONS.OPERATIONS)
            .eq("checkoutSessionId", checkoutSessionId)
            .ne(FIELDS.OKINI_TYPE, "holiday")
            .find();

        $w('#repeater2').data = []; // Wipe ghost data from editor
        $w('#repeater2').data = selectedOps.items || [];
    } catch (err) {
        console.error("Error populating Repeater 2:", err);
    }
}

// ====================================================================
// --- Form Setup ---
// ====================================================================
function setupCheckoutForm() {
    const submitButton = $w('#button20');
    submitButton.disable(); 

    $w('#input1').onInput(validateCheckoutForm);
    $w('#checkboxGroup1').onChange(validateCheckoutForm);
    validateCheckoutForm();

    submitButton.onClick(async () => {
        submitButton.disable();
        submitButton.label = "Processing...";

        try {
            // Processing logic goes here
            submitButton.label = "Success!";
        } catch (err) {
            console.error("Checkout failed:", err);
            submitButton.label = "Error - Please Try Again";
            submitButton.enable(); 
        }
    });
}

function validateCheckoutForm() {
    const isDonorInfoValid = $w('#input1').valid && $w('#checkboxGroup1').valid;
    if (isDonorInfoValid) {
        $w('#button20').enable();
    } else {
        $w('#button20').disable();
    }
}