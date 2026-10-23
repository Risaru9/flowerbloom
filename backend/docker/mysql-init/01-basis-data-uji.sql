-- Basis data khusus pengujian (dikosongkan tiap tes; JANGAN diarahkan ke data sungguhan).
-- Dijalankan otomatis hanya saat volume MySQL pertama kali dibuat.
CREATE DATABASE IF NOT EXISTS flowerbloom_uji CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON flowerbloom_uji.* TO 'flowerbloom'@'%';
FLUSH PRIVILEGES;
