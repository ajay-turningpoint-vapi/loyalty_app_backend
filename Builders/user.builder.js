import { rolesObj } from "../helpers/Constants";

export const UserListwithOutPagination = (payload) => {
    let pipeline = [],
        matchCondition = {},
        sortCondition = { isActive: 1, kycStatus: 1, createdAt: -1 };

    // Apply KYC status filter if provided
    if (payload.kycStatus) {
        matchCondition.kycStatus = payload.kycStatus;
    }

    // Apply role exclusion if necessary (exclude ADMIN role directly in the aggregation)
    // Assuming rolesObj.ADMIN is the value for the ADMIN role
    matchCondition.role = { $ne: rolesObj.ADMIN }; // Exclude users with ADMIN role

    // Aggregation pipeline
    pipeline.push(
        // Match stage: filter based on the conditions defined above
        { $match: matchCondition },

        // Projection: limit the fields that are returned to reduce data transfer
        {
            $project: {
                _id: 1,
                name: 1,
                email: 1,
                phone: 1,
                role: 1,
                firstName: 1,
                lastName: 1,
                businessName: 1,
                dob: 1,
                country: 1,
                stateName: 1,
                pincode: 1,
                language: 1,
                isActive: 1,
                adressLine: 1,
                image: 1,
                points: 1,
                idFrontImage: 1,
                idBackImage: 1,
                selfie: 1,
                bankDetails: 1,
                visitingCard: 1,
                shopImage: 1,
                onlinePortal: 1,
                kycStatus: 1,
                createdAt: 1,
                updatedAt: 1,
                isOnline: 1,
                isBlocked: 1,
                note: 1,
                contractor: 1,
            },
        },

        // Sort by multiple fields: isActive, kycStatus, createdAt
        { $sort: sortCondition },

        // Add custom field for sorting kycStatusOrder
        {
            $addFields: {
                kycStatusOrder: {
                    $switch: {
                        branches: [{ case: { $eq: ["$kycStatus", "submitted"] }, then: 1 }],
                        default: 2,
                    },
                },
            },
        },

        // Combine sorting stages: Sort by kycStatusOrder and other fields
        { $sort: { kycStatusOrder: 1, ...sortCondition } }
    );

    return pipeline;
};

export const UserList = (payload) => {
    let pipeline = [],
        matchCondition = {},
        sortCondition = {};

    // Apply KYC status filter if provided
    if (payload.kycStatus) {
        matchCondition.kycStatus = payload.kycStatus;
    }

    // Exclude ADMIN role
    matchCondition.role = { $ne: rolesObj.ADMIN };

    // Search by phone or email
    const searchQuery = payload.search?.trim() || ""; // Ensure it's a string
    const searchRegex = searchQuery
        ? searchQuery
              .split(" ")
              .map((word) => `(?=.*${word})`)
              .join("")
        : ""; // Handle empty search case

    if (searchRegex) {
        matchCondition.$or = [{ phone: { $regex: searchRegex, $options: "i" } }, { email: { $regex: searchRegex, $options: "i" } }, { name: { $regex: searchRegex, $options: "i" } }];
    }

    // Sorting logic
    if (payload.sortBy) {
        let sortField = payload.sortBy;
        let sortOrder = payload.sortOrder === "desc" ? -1 : 1;
        sortCondition[sortField] = sortOrder;
    } else {
        // Default sorting
        sortCondition = { isActive: 1, kycStatus: 1, createdAt: -1, role: 1 };
    }

    // Date range filtering for createdAt
    // if (payload.startDate || payload.endDate) {
    //     matchCondition.createdAt = {};
    //     if (payload.startDate) {
    //         matchCondition.createdAt.$gte = new Date(payload.startDate);
    //     }
    //     if (payload.endDate) {
    //         matchCondition.createdAt.$lte = new Date(payload.endDate);
    //     }
    // }

    if (payload.startDate || payload.endDate) {
        matchCondition.createdAt = {};
        if (payload.startDate) {
            matchCondition.createdAt.$gte = new Date(payload.startDate);
        }
        if (payload.endDate) {
            let endDate = new Date(payload.endDate);
            endDate.setHours(23, 59, 59, 999); // Set time to the end of the day
            matchCondition.createdAt.$lte = endDate;
        }
    }

    // Pagination: limit & skip
    let limit = parseInt(payload.limit) || 10;
    let skip = (parseInt(payload.page) - 1) * limit || 0;

    // Aggregation pipeline
    pipeline.push(
        { $match: matchCondition },

        {
            $project: {
                _id: 1,
                name: 1,
                email: 1,
                phone: 1,
                role: 1,
                businessName: 1,
                pincode: 1,
                isActive: 1,
                image: 1,
                points: 1,
                idFrontImage: 1,
                idBackImage: 1,
                selfie: 1,
                bankDetails: 1,
                kycStatus: 1,
                createdAt: 1,
                updatedAt: 1,
                isOnline: 1,
                isBlocked: 1,
                note: 1,
                contractor: 1,
                isActiveDate: 1,
                isVerified: 1,
                diamonds: 1,
                accumulatedPoints: 1,
            },
        },

        { $sort: sortCondition },

        { $skip: skip },

        { $limit: limit }
    );

    return pipeline;
};
