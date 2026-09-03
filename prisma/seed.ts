import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("change-me-now", 12);
  const manager = await prisma.user.upsert({
    where: { email: "manager@doroudi.local" },
    update: {},
    create: {
      name: "مدیر درودی",
      email: "manager@doroudi.local",
      passwordHash,
      role: UserRole.MANAGER,
    },
  });

  const warehouse = await prisma.warehouse.upsert({
    where: { name: "انبار مرکزی" },
    update: {},
    create: { name: "انبار مرکزی", isDefault: true },
  });

  const brand = await prisma.brand.upsert({
    where: { slug: "schneider" },
    update: {},
    create: { name: "اشنایدر", slug: "schneider" },
  });
  const category = await prisma.category.upsert({
    where: { slug: "breakers" },
    update: {},
    create: { name: "کلید و فیوز", slug: "breakers" },
  });

  await prisma.product.upsert({
    where: { sku: "SCH-LC1D25" },
    update: {},
    create: {
      sku: "SCH-LC1D25",
      name: "کنتاکتور اشنایدر LC1D25",
      unit: "عدد",
      attributes: { poles: 3, ratedCurrentA: 25, coilVoltage: "220VAC" },
      costPriceRial: 42000000,
      salePriceRial: 48500000,
      reorderPoint: 5,
      brandId: brand.id,
      categoryId: category.id,
    },
  });

  await prisma.customer.upsert({
    where: { id: "00000000-0000-0000-0000-00000000d001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-00000000d001",
      name: "فروشگاه برق سمنان",
      type: "RETAILER",
      paymentTermsDays: 15,
      creditLimitRial: 200000000,
      phone: "023-0000000",
    },
  });

  console.log(`Seeded ${manager.email}, warehouse "${warehouse.name}", demo customer`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
