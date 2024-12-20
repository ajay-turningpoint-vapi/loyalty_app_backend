import { storeFileAndReturnNameBase64 } from "../helpers/fileSystem";
import Category from "../models/category.model";

export const addCategory = async (req, res, next) => {
    try {
        // console.log(req.body);
        const CategoryNameCheck = await Category.findOne({
            $or: [{ name: new RegExp(`^${req.body.name}$`, "i") }, { slug: new RegExp(`^${req.body.slug}$`) }],
        }).exec();
        if (CategoryNameCheck) throw new Error("Entry Already exist please change brand name or url");
        let obj = {};
        if (req.body.imageStr) {
            req.body.categoryImage = await storeFileAndReturnNameBase64(req.body.imageStr);
        }
        if (req.body.parentCategoryId) {
            let categoryObj = await Category.findById(req.body.parentCategoryId).lean().exec();
            // console.log(categoryObj, "objjjjjj")
            let parentCategoryArr = [...categoryObj.parentCategoryArr];
            // console.log(parentCategoryArr, "pppppppp");
            parentCategoryArr.push({ parentId: categoryObj._id });
            obj = {
                ...req.body,
                order: categoryObj.order + 1,
                level: categoryObj.level + 1,
                parentCategoryArr,
            };
        } else {
            const categoryCount = await Category.countDocuments({ level: 1 }).exec();
            obj = { ...req.body, order: categoryCount + 1, level: 1 };
        }
        let newEntry = new Category(obj).save();
        if (!newEntry) throw new Error("Unable to create Category");
        res.status(200).json({ message: "Category Successfully Created", success: true });
    } catch (err) {
        next(err);
    }
};

export const getCategory = async (req, res, next) => {
    try {
        let categoryArr = await Category.find().lean().exec();
        // console.log(getCategory, "efnwfnewfo")
        for (let el of categoryArr) {
            console.log(el);
            if (el.parentCategoryId) {
                let parentObj = await Category.findById(el.parentCategoryId).lean().exec();
                if (parentObj) {
                    el.parentCategoryName = parentObj.name;
                }
            }
        }
        res.status(200).json({ message: "getCategory", data: categoryArr, success: true });
    } catch (err) {
        next(err);
    }
};

export const updateById = async (req, res, next) => {
    try {
        let obj = {};
        if (req.body.imageStr) {
            req.body.categoryImage = await storeFileAndReturnNameBase64(req.body.imageStr);
        }
        if (req.body.parentCategoryId) {
            let categoryObj = await Category.findById(req.body.parentCategoryId).lean().exec();
            let parentCategoryArr = [...categoryObj.parentCategoryArr];
            parentCategoryArr.push({ parentId: categoryObj._id });
            obj = {
                ...req.body,
                order: categoryObj.order + 1,
                level: categoryObj.level + 1,
                parentCategoryArr,
            };
        } else {
            const categoryCount = await Category.countDocuments({ level: 1 }).exec();
            obj = { ...req.body, order: categoryCount + 1, level: 1 };
        }
        await Category.findByIdAndUpdate(req.params.id, obj).exec();

        res.status(200).json({ message: "category Updated", success: true });
    } catch (err) {
        next(err);
    }
};
export const deleteById = async (req, res, next) => {
    try {
        const categoryObj = await Category.findByIdAndDelete(req.params.id).exec();
        if (!categoryObj) throw { status: 400, message: "category Not Found" };
        res.status(200).json({ message: "category Deleted", success: true });
    } catch (err) {
        next(err);
    }
};

export const getNestedCategory = async (req, res, next) => {
    try {
        let mainCategoryArr = await Category.find({ "deletedObj.deletedBool": false }).lean().exec();
        const setSubcategoryArr = (id) => {
            if (!id) return [];
            let tempArr = mainCategoryArr.filter((el) => el.parentCategoryId == `${id}`);
            if (tempArr.length == 0) return [];
            return tempArr
                .map((el) => {
                    let obj = {
                        ...el,
                        label: el.name,
                        value: el._id,
                        subCategoryArr: setSubcategoryArr(el._id),
                        isExpanded: true,
                    };
                    return obj;
                })
                .sort((a, b) => a.order - b.order);
        };
        let finalArr = mainCategoryArr
            .filter((el) => el.level == 1)
            .map((el) => {
                let obj = {
                    ...el,
                    label: el.name,
                    value: el._id,
                    subCategoryArr: setSubcategoryArr(el._id),
                    isExpanded: true,
                };
                return obj;
            })
            .sort((a, b) => a.order - b.order);
        res.status(200).json({ message: "Category Arr", data: finalArr, success: true });
    } catch (err) {
        next(err);
    }
};
