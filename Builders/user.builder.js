export const UserList = (payload) => {
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
                bankDetails: 1,
                visitingCard: 1,
                shopImage: 1,
                onlinePortal: 1,
                kycStatus: 1,
                createdAt: 1,
                isOnline: 1,
                isBlocked: 1,
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
