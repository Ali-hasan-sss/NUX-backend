"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getItemsByCategoryForCustomer = exports.getCategoriesByQRCode = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
/**
 * @swagger
 * /customer/menu/{qrCode}:
 *   get:
 *     summary: Get all menu categories of a restaurant by QR code (restaurant ID)
 *     tags: [Menu Customer]
 *     parameters:
 *       - in: path
 *         name: qrCode
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID of the restaurant from QR code
 *     responses:
 *       200:
 *         description: Successfully retrieved categories
 *       404:
 *         description: Restaurant not found
 *       500:
 *         description: Server error
 */
// controller
const getCategoriesByQRCode = async (req, res) => {
    try {
        const { qrCode } = req.params; // هذا الـ qrCode فعليًا هو restaurantId
        if (!qrCode)
            return res.status(400).json({ success: false, message: 'QR code is required' });
        const restaurant = await prisma.restaurant.findUnique({
            where: { id: qrCode }, // id هو String
            select: { id: true },
        });
        if (!restaurant)
            return res.status(404).json({ success: false, message: 'Restaurant not found' });
        const categories = await prisma.menuCategory.findMany({
            where: { restaurantId: restaurant.id },
        });
        res.json({ success: true, data: categories });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.getCategoriesByQRCode = getCategoriesByQRCode;
/**
 * @swagger
 * /customer/menu/items/{categoryId}:
 *   get:
 *     summary: Get all menu items for a specific category by categoryId
 *     tags: [Menu Customer]
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         schema:
 *           type: integer
 *         required: true
 *         description: ID of the category to fetch items
 *     responses:
 *       200:
 *         description: Successfully retrieved menu items
 *       404:
 *         description: Category not found
 *       500:
 *         description: Server error
 */
const getItemsByCategoryForCustomer = async (req, res) => {
    try {
        const { categoryId } = req.params;
        if (!categoryId)
            return res.status(400).json({ success: false, message: 'Category ID is required' });
        const category = await prisma.menuCategory.findUnique({
            where: { id: parseInt(categoryId) },
            include: { items: true },
        });
        if (!category)
            return res.status(404).json({ success: false, message: 'Category not found' });
        res.json({ success: true, data: category.items });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
exports.getItemsByCategoryForCustomer = getItemsByCategoryForCustomer;
//# sourceMappingURL=menuClient.controller.js.map