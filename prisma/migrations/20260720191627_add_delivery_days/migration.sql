-- AlterTable
ALTER TABLE "Yard" ADD COLUMN     "deliveryDays" INTEGER[] DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6]::INTEGER[];
