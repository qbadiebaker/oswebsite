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
    // *** ADDED: Field key for the coordinator ***
    COORDINATOR: "coordinator" // <-- Added Coordinator Field Key
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


/**
 * Creates a "flat" list of families and their needs and populates the main repeater.
 * *** MODIFIED: Added filter for 'holiday' okini type. ***
 * *** MODIFIED: Uses #text148 for contact info. ***
 */
async function populateFamilyAndIndividualList() {
    console.log("Starting to build the HOLIDAY request list...");
    const flatList = [];

    const familiesResult = await wixData.query(COLLECTIONS.FAMILIES).find();
    if (familiesResult.items.length === 0) {
        console.log("No families found in the collection.");
        $w('#repeater1').data = [];
        return;
    }
    console.log(`Found ${familiesResult.items.length} families to process for holiday requests.`);

    for (const family of familiesResult.items) {
        const familyRequestsQuery = wixData.query(COLLECTIONS.OPERATIONS)
            .hasSome(FIELDS.OP_FAMILY_REF, family._id)
            .isEmpty(FIELDS.OP_INDIVIDUAL_REF)
            .eq(FIELDS.OKINI_TYPE, "holiday")
            .eq("liveOnWebsite", true) 
            .find();

        const individualsQuery = wixData.query(COLLECTIONS.INDIVIDUALS)
            .hasSome(FIELDS.INDIVIDUAL_FAMILY_REF, family._id)
            .find();

        const [familyRequests, individuals] = await Promise.all([familyRequestsQuery, individualsQuery]);

        let hasAnyHolidayRequests = familyRequests.items.length > 0;
        const individualItems = [];

        for (const individual of individuals.items) {
             const individualRequestQuery = await wixData.query(COLLECTIONS.OPERATIONS)
                .hasSome(FIELDS.OP_INDIVIDUAL_REF, individual._id)
                .eq(FIELDS.OKINI_TYPE, "holiday")
                .eq("liveOnWebsite", true)
                .find();

            if (individualRequestQuery.items.length > 0) {
                 hasAnyHolidayRequests = true;
                 individualItems.push({
                    _id: individual._id,
                    type: 'individual',
                    data: { individual, request: individualRequestQuery.items[0] }
                });
            }
        }

        if (hasAnyHolidayRequests) {
            flatList.push({
                _id: family._id,
                type: 'family',
                data: {
                    familyDetails: family,
                    familyRequest: familyRequests.items.length > 0 ? familyRequests.items[0] : null
                }
            });
            flatList.push(...individualItems);
        }
    }

    console.log(`Populating main repeater (#repeater1) with ${flatList.length} total holiday items.`);
    const repeater = $w('#repeater1');
    repeater.data = flatList;

    // *** MODIFIED: Use #text148 for contact info, remove from #requestInfoText ***
    repeater.onItemReady(($item, item, index) => {
        const requestInfoTextElement = $item('#requestInfoText');
        const contactTextElement = $item('#text148'); // Get the dedicated text element
        let htmlString = "";
        let requestData = null; // To hold the relevant request object

        switch (item.type) {
            case 'family':
                const { familyDetails, familyRequest } = item.data;
                requestData = familyRequest; // Assign the family request
                // Build HTML without contact info
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
                requestData = request; // Assign the individual request
                // Build HTML without contact info, keep indent (adjusted from original 20px)
                htmlString = `<p style="margin-left: 40px;"><strong>${individual.boyOrGirl || 'Member'}, Age: ${individual.age || ''}</strong><br><strong>Needs:</strong> ${request.requestDonationDetails || 'N/A'}<br><strong>Sizes:</strong> ${request.sizeDetails || 'N/A'}</p>`;
                configureSwitchAndUrgentBox($item, request);
                break;
        }

        // Set the main request info text
        requestInfoTextElement.html = htmlString;

        // --- Handle the Contact Text Element ---
        const coordinatorName = requestData ? requestData[FIELDS.COORDINATOR] : null;

        if (coordinatorName) {
            contactTextElement.text = `Contact: ${coordinatorName}`;
            contactTextElement.expand(); // Make sure it's visible
        } else {
            contactTextElement.text = ""; // Clear text just in case
            contactTextElement.collapse(); // Hide if no coordinator
        }
    });
}


// --- Functions below remain unchanged ---

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
        .eq(FIELDS.OKINI_TYPE, "holiday")
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

    // --- 1. Disable the button by default ---
    submitButton.disable();

    // --- 2. Add listeners to your required inputs ---
    // (Assuming they are the same as the other page: #input1 and #checkboxGroup1)
    $w('#input1').onInput(validateCheckoutForm);
    $w('#checkboxGroup1').onChange(validateCheckoutForm);
    
    // --- 3. Run validation once on page load ---
    validateCheckoutForm();

    // --- 4. Your existing Holiday onClick logic stays inside ---
    submitButton.onClick(async () => {
        submitButton.disable();
        submitButton.label = "Processing...";

        try {
            // This is your original Holiday submit logic
            const newDonorData = {
                donorName: $w('#input3').value,
                donorEmail: $w('#input1').value,
                phone: $w('#input2').value,
                donorId: `DON-${Date.now()}`
            };

            const newDonor = await wixData.insert(COLLECTIONS.DONORS, newDonorData);

            const selectedOps = await wixData.query(COLLECTIONS.OPERATIONS)
                .eq("checkoutSessionId", checkoutSessionId)
                .eq(FIELDS.OKINI_TYPE, "holiday") // Correctly queries for holiday
                .find();

            for (const operation of selectedOps.items) {
                await wixData.insertReference(COLLECTIONS.DONORS, FIELDS.DONOR_OPS_REF, newDonor._id, operation._id);
                await wixData.insertReference(COLLECTIONS.OPERATIONS, FIELDS.OP_DONOR_REF, operation._id, newDonor._id);
                await wixData.save(COLLECTIONS.OPERATIONS, { ...operation, checkoutSessionId: null });
            }

            submitButton.label = "Success!";
            // session.removeItem("checkoutSessionId"); // Optional

        } catch (err) {
            console.error("Checkout failed:", err);
            submitButton.label = "Error - Please Try Again";
            submitButton.enable(); // Re-enable on error
        }
    });
}


/**
 * Checks if the form is valid and enables/disables the submit button.
 */
function validateCheckoutForm() {
    // Assumes #input1 (Email) and #checkboxGroup1 are set as 'Required' in the Editor.
    // If your required fields are different, just update them here.
    const isDonorInfoValid = $w('#input1').valid && $w('#checkboxGroup1').valid;

    // Enable button ONLY if inputs are valid
    if (isDonorInfoValid) {
        $w('#button20').enable();
    } else {
        $w('#button20').disable();
    }
}