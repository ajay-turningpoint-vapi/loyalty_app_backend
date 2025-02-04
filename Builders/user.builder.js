import { rolesObj } from "../helpers/Constants";

export const UserListOld = (payload) => {
    console.log(payload);
    let pipeline = [],
        matchCondition = {},
        sortCondition = {};

    // if (payload.role != "") {
    //     matchCondition.role = { $regex: new RegExp(`\\s+${payload.role.trim()}|${payload.role.trim()}`), $options: "-i" };
    // }
    if (payload.kycStatus) {
        matchCondition.kycStatus = payload.kycStatus;
    }
    sortCondition = { isActive: 1, kycStatus: 1, createdAt: -1 };
    pipeline.push(
        { $match: matchCondition },
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
        { $sort: sortCondition },
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
        { $sort: { kycStatusOrder: 1 } }
    );

    return pipeline;
};

export const UserList = (payload) => {
    console.log(payload);
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
