-- AlterEnum
ALTER TYPE "public"."contract_file_format" ADD VALUE 'rich_text';

-- AlterTable
ALTER TABLE "public"."contract_templates" ADD COLUMN     "html_content" TEXT,
ALTER COLUMN "file_path" DROP NOT NULL,
ALTER COLUMN "file_size" DROP NOT NULL,
ALTER COLUMN "original_name" DROP NOT NULL;
