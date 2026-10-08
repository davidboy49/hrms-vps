-- Sidebar favourites are saved per user instead of per browser.
ALTER TABLE "User" ADD COLUMN "favorites" TEXT[] DEFAULT ARRAY[]::TEXT[];
