-- MySQL dump 10.13  Distrib 8.4.11, for Linux (x86_64)
--
-- Host: 127.0.0.1    Database: ragemp
-- ------------------------------------------------------
-- Server version	8.4.11-0ubuntu0.26.04.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `ragemp`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `ragemp` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `ragemp`;

--
-- Table structure for table `car_keys`
--

DROP TABLE IF EXISTS `car_keys`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `car_keys` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `owner_social_club` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `grantee_social_club` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `grantee_name` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_fb8af5e47c62474cf82dfa5f3c` (`owner_social_club`,`grantee_social_club`),
  KEY `IDX_f6a9393998fafad75488d7a834` (`owner_social_club`),
  KEY `IDX_d34da22e7ac5b0cff18f2f310c` (`grantee_social_club`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `car_keys`
--

LOCK TABLES `car_keys` WRITE;
/*!40000 ALTER TABLE `car_keys` DISABLE KEYS */;
/*!40000 ALTER TABLE `car_keys` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `car_tuning`
--

DROP TABLE IF EXISTS `car_tuning`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `car_tuning` (
  `model` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `stage` varchar(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `speed` float NOT NULL DEFAULT '1',
  PRIMARY KEY (`model`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `car_tuning`
--

LOCK TABLES `car_tuning` WRITE;
/*!40000 ALTER TABLE `car_tuning` DISABLE KEYS */;
INSERT INTO `car_tuning` VALUES ('23rs7abt','Stage 3',1.1);
INSERT INTO `car_tuning` VALUES ('bs17','Stage 3',2);
INSERT INTO `car_tuning` VALUES ('cbr1000rrr','Stage 2',1);
INSERT INTO `car_tuning` VALUES ('mansm8c','Stage 3',1.5);
INSERT INTO `car_tuning` VALUES ('mercedessclass27','Stage 3',1);
INSERT INTO `car_tuning` VALUES ('polrevent','Stage 2',1);
INSERT INTO `car_tuning` VALUES ('r820','',2.5);
INSERT INTO `car_tuning` VALUES ('rrst','Stage 2+',1);
INSERT INTO `car_tuning` VALUES ('xg632019','Stage 3',1);
/*!40000 ALTER TABLE `car_tuning` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `characters`
--

DROP TABLE IF EXISTS `characters`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `characters` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `first_name` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_name` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `gender` char(1) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `money` bigint NOT NULL DEFAULT '0',
  `bank` bigint NOT NULL DEFAULT '0',
  `hunger` float NOT NULL DEFAULT '100',
  `thirst` float NOT NULL DEFAULT '100',
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `appearance` json DEFAULT NULL,
  `equipment` json DEFAULT NULL,
  `clothing` json DEFAULT NULL,
  `tattoos` json DEFAULT NULL,
  `last_position` json DEFAULT NULL,
  `legacy_imported` tinyint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_b337ef726f3f16519f8e69a002` (`first_name`,`last_name`),
  KEY `FK_c6e648aeaab79e4213def02aba8` (`user_id`),
  CONSTRAINT `FK_c6e648aeaab79e4213def02aba8` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `characters`
--

LOCK TABLES `characters` WRITE;
/*!40000 ALTER TABLE `characters` DISABLE KEYS */;
INSERT INTO `characters` VALUES (1,1,'Sephi','Redveil','m',14699437,0,100,100,'2026-10-03 02:20:38.506401','2026-10-05 22:38:30.000000','{\"hair\": {\"color\": 29, \"style\": 81, \"highlight\": 29}, \"eyeColor\": 31, \"features\": [-1, 0.3, 0, 0, 0, 0, 0, 0, 0, 1, 0.6, 0, 0, 0.4, -1, 0.1, 0, -0.2, 0, 1], \"heritage\": {\"dad\": 45, \"mom\": 0, \"skinMix\": 0.5, \"shapeMix\": 0.5}, \"overlays\": {\"beard\": {\"color\": 0, \"style\": -1, \"opacity\": 0}, \"blush\": {\"color\": 0, \"style\": -1, \"opacity\": 1}, \"moles\": {\"style\": -1, \"opacity\": 1}, \"ageing\": {\"style\": -1, \"opacity\": 1}, \"makeup\": {\"style\": -1, \"opacity\": 0}, \"eyebrows\": {\"color\": 0, \"style\": 1, \"opacity\": 1}, \"lipstick\": {\"color\": 0, \"style\": -1, \"opacity\": 1}, \"blemishes\": {\"style\": -1, \"opacity\": 0}, \"chesthair\": {\"color\": 0, \"style\": -1, \"opacity\": 1}, \"sundamage\": {\"style\": -1, \"opacity\": 1}, \"complexion\": {\"style\": -1, \"opacity\": 1}, \"bodyblemishes\": {\"style\": -1, \"opacity\": 1}}}','{\"clothing\": {\"pants\": {\"d\": 28, \"t\": 0, \"id\": \"cloth_pants_28_0\"}, \"shoes\": {\"d\": 126, \"t\": 3, \"id\": \"cloth_shoes_126_3\"}, \"watch\": {\"d\": 1, \"t\": 0, \"id\": \"cloth_watch_1_0\"}, \"bracelet\": {\"d\": 13, \"t\": 0, \"id\": \"cloth_bracelet_13_0\"}}}',NULL,'{\"m\": [714, 718, 706, 621, 644, 643, 653, 434, 331, 393, 402, 551, 573, 934, 918, 915, 845, 848, 332]}','{\"x\": 92.11, \"y\": -1050.69, \"z\": 29.62, \"dim\": 0, \"heading\": -23.3}',1);
INSERT INTO `characters` VALUES (2,2,'Tor','Nocturne','m',1410858,0,100,100,'2026-10-03 02:22:08.349208','2026-10-08 01:50:58.000000','{\"hair\": {\"color\": 0, \"style\": 11, \"highlight\": 0}, \"eyeColor\": 0, \"features\": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], \"heritage\": {\"dad\": 0, \"mom\": 0, \"skinMix\": 0.5, \"shapeMix\": 0.5}, \"overlays\": {\"beard\": {\"color\": 0, \"style\": -1, \"opacity\": 1}, \"blush\": {\"color\": 0, \"style\": -1, \"opacity\": 1}, \"moles\": {\"style\": -1, \"opacity\": 1}, \"ageing\": {\"style\": -1, \"opacity\": 1}, \"makeup\": {\"style\": -1, \"opacity\": 1}, \"eyebrows\": {\"color\": 0, \"style\": -1, \"opacity\": 1}, \"lipstick\": {\"color\": 0, \"style\": -1, \"opacity\": 1}, \"blemishes\": {\"style\": -1, \"opacity\": 1}, \"chesthair\": {\"color\": 0, \"style\": -1, \"opacity\": 1}, \"sundamage\": {\"style\": -1, \"opacity\": 1}, \"complexion\": {\"style\": -1, \"opacity\": 1}, \"bodyblemishes\": {\"style\": -1, \"opacity\": 1}}}','{\"clothing\": {\"top\": {\"d\": 80, \"t\": 2, \"id\": \"cloth_top_80_2\"}, \"neck\": {\"d\": 49, \"t\": 0, \"id\": \"cloth_neck_49_0\"}, \"pants\": {\"d\": 7, \"t\": 0, \"id\": \"cloth_pants_7_0\"}, \"shoes\": {\"d\": 1, \"t\": 1, \"id\": \"cloth_shoes_1_1\"}, \"watch\": {\"d\": 1, \"t\": 0, \"id\": \"cloth_watch_1_0\"}, \"glasses\": {\"d\": 7, \"t\": 0, \"id\": \"cloth_glasses_7_0\"}, \"bracelet\": {\"d\": 5, \"t\": 0, \"id\": \"cloth_bracelet_5_0\"}}}',NULL,'{}','{\"x\": 1154.11, \"y\": -1525.11, \"z\": 34.84, \"dim\": 0, \"heading\": -98.48}',1);
INSERT INTO `characters` VALUES (3,3,'Test','User',NULL,0,0,100,100,'2026-10-04 21:34:22.297447','2026-10-04 21:34:22.297447',NULL,NULL,NULL,NULL,NULL,0);
INSERT INTO `characters` VALUES (4,4,'Dup','User',NULL,0,0,100,100,'2026-10-04 21:34:45.864288','2026-10-04 21:34:45.864288',NULL,NULL,NULL,NULL,NULL,0);
/*!40000 ALTER TABLE `characters` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `disabled_clothing`
--

DROP TABLE IF EXISTS `disabled_clothing`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `disabled_clothing` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `gender` varchar(1) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cat` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `drawable` int NOT NULL,
  `texture` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_b232fc71476936ee855cd550db` (`gender`,`cat`,`drawable`,`texture`)
) ENGINE=InnoDB AUTO_INCREMENT=1240 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `disabled_clothing`
--

LOCK TABLES `disabled_clothing` WRITE;
/*!40000 ALTER TABLE `disabled_clothing` DISABLE KEYS */;
INSERT INTO `disabled_clothing` VALUES (921,'m','mask',0,-1);
INSERT INTO `disabled_clothing` VALUES (928,'m','mask',1,-1);
INSERT INTO `disabled_clothing` VALUES (927,'m','mask',2,-1);
INSERT INTO `disabled_clothing` VALUES (926,'m','mask',3,-1);
INSERT INTO `disabled_clothing` VALUES (925,'m','mask',4,-1);
INSERT INTO `disabled_clothing` VALUES (924,'m','mask',5,-1);
INSERT INTO `disabled_clothing` VALUES (923,'m','mask',6,-1);
INSERT INTO `disabled_clothing` VALUES (922,'m','mask',7,-1);
INSERT INTO `disabled_clothing` VALUES (929,'m','mask',8,-1);
INSERT INTO `disabled_clothing` VALUES (930,'m','mask',9,-1);
INSERT INTO `disabled_clothing` VALUES (931,'m','mask',10,-1);
INSERT INTO `disabled_clothing` VALUES (932,'m','mask',11,-1);
INSERT INTO `disabled_clothing` VALUES (933,'m','mask',12,-1);
INSERT INTO `disabled_clothing` VALUES (934,'m','mask',13,-1);
INSERT INTO `disabled_clothing` VALUES (935,'m','mask',14,-1);
INSERT INTO `disabled_clothing` VALUES (936,'m','mask',15,-1);
INSERT INTO `disabled_clothing` VALUES (937,'m','mask',16,-1);
INSERT INTO `disabled_clothing` VALUES (938,'m','mask',17,-1);
INSERT INTO `disabled_clothing` VALUES (939,'m','mask',18,-1);
INSERT INTO `disabled_clothing` VALUES (940,'m','mask',19,-1);
INSERT INTO `disabled_clothing` VALUES (941,'m','mask',20,-1);
INSERT INTO `disabled_clothing` VALUES (942,'m','mask',21,-1);
INSERT INTO `disabled_clothing` VALUES (943,'m','mask',22,-1);
INSERT INTO `disabled_clothing` VALUES (944,'m','mask',23,-1);
INSERT INTO `disabled_clothing` VALUES (945,'m','mask',24,-1);
INSERT INTO `disabled_clothing` VALUES (946,'m','mask',25,-1);
INSERT INTO `disabled_clothing` VALUES (947,'m','mask',26,-1);
INSERT INTO `disabled_clothing` VALUES (948,'m','mask',27,-1);
INSERT INTO `disabled_clothing` VALUES (949,'m','mask',28,-1);
INSERT INTO `disabled_clothing` VALUES (950,'m','mask',29,-1);
INSERT INTO `disabled_clothing` VALUES (951,'m','mask',30,-1);
INSERT INTO `disabled_clothing` VALUES (952,'m','mask',31,-1);
INSERT INTO `disabled_clothing` VALUES (953,'m','mask',32,-1);
INSERT INTO `disabled_clothing` VALUES (954,'m','mask',33,-1);
INSERT INTO `disabled_clothing` VALUES (955,'m','mask',34,-1);
INSERT INTO `disabled_clothing` VALUES (956,'m','mask',36,-1);
INSERT INTO `disabled_clothing` VALUES (957,'m','mask',38,-1);
INSERT INTO `disabled_clothing` VALUES (958,'m','mask',39,-1);
INSERT INTO `disabled_clothing` VALUES (959,'m','mask',40,-1);
INSERT INTO `disabled_clothing` VALUES (960,'m','mask',41,-1);
INSERT INTO `disabled_clothing` VALUES (961,'m','mask',42,-1);
INSERT INTO `disabled_clothing` VALUES (962,'m','mask',43,-1);
INSERT INTO `disabled_clothing` VALUES (963,'m','mask',44,-1);
INSERT INTO `disabled_clothing` VALUES (964,'m','mask',45,-1);
INSERT INTO `disabled_clothing` VALUES (965,'m','mask',47,-1);
INSERT INTO `disabled_clothing` VALUES (966,'m','mask',49,-1);
INSERT INTO `disabled_clothing` VALUES (967,'m','mask',50,-1);
INSERT INTO `disabled_clothing` VALUES (968,'m','mask',55,-1);
INSERT INTO `disabled_clothing` VALUES (970,'m','mask',59,-1);
INSERT INTO `disabled_clothing` VALUES (971,'m','mask',60,-1);
INSERT INTO `disabled_clothing` VALUES (972,'m','mask',61,-1);
INSERT INTO `disabled_clothing` VALUES (973,'m','mask',62,-1);
INSERT INTO `disabled_clothing` VALUES (974,'m','mask',63,-1);
INSERT INTO `disabled_clothing` VALUES (975,'m','mask',64,-1);
INSERT INTO `disabled_clothing` VALUES (976,'m','mask',65,-1);
INSERT INTO `disabled_clothing` VALUES (977,'m','mask',66,-1);
INSERT INTO `disabled_clothing` VALUES (978,'m','mask',67,-1);
INSERT INTO `disabled_clothing` VALUES (979,'m','mask',68,-1);
INSERT INTO `disabled_clothing` VALUES (980,'m','mask',69,-1);
INSERT INTO `disabled_clothing` VALUES (981,'m','mask',70,-1);
INSERT INTO `disabled_clothing` VALUES (982,'m','mask',71,-1);
INSERT INTO `disabled_clothing` VALUES (983,'m','mask',72,-1);
INSERT INTO `disabled_clothing` VALUES (984,'m','mask',73,-1);
INSERT INTO `disabled_clothing` VALUES (985,'m','mask',74,-1);
INSERT INTO `disabled_clothing` VALUES (986,'m','mask',75,-1);
INSERT INTO `disabled_clothing` VALUES (987,'m','mask',76,-1);
INSERT INTO `disabled_clothing` VALUES (988,'m','mask',77,-1);
INSERT INTO `disabled_clothing` VALUES (989,'m','mask',78,-1);
INSERT INTO `disabled_clothing` VALUES (990,'m','mask',79,-1);
INSERT INTO `disabled_clothing` VALUES (991,'m','mask',80,-1);
INSERT INTO `disabled_clothing` VALUES (992,'m','mask',81,-1);
INSERT INTO `disabled_clothing` VALUES (993,'m','mask',82,-1);
INSERT INTO `disabled_clothing` VALUES (994,'m','mask',83,-1);
INSERT INTO `disabled_clothing` VALUES (995,'m','mask',84,-1);
INSERT INTO `disabled_clothing` VALUES (996,'m','mask',85,-1);
INSERT INTO `disabled_clothing` VALUES (997,'m','mask',86,-1);
INSERT INTO `disabled_clothing` VALUES (998,'m','mask',87,-1);
INSERT INTO `disabled_clothing` VALUES (999,'m','mask',88,-1);
INSERT INTO `disabled_clothing` VALUES (1000,'m','mask',89,-1);
INSERT INTO `disabled_clothing` VALUES (1001,'m','mask',91,-1);
INSERT INTO `disabled_clothing` VALUES (1002,'m','mask',92,-1);
INSERT INTO `disabled_clothing` VALUES (1003,'m','mask',93,-1);
INSERT INTO `disabled_clothing` VALUES (1004,'m','mask',94,-1);
INSERT INTO `disabled_clothing` VALUES (1005,'m','mask',95,-1);
INSERT INTO `disabled_clothing` VALUES (1006,'m','mask',96,-1);
INSERT INTO `disabled_clothing` VALUES (1007,'m','mask',97,-1);
INSERT INTO `disabled_clothing` VALUES (1008,'m','mask',98,-1);
INSERT INTO `disabled_clothing` VALUES (1010,'m','mask',99,-1);
INSERT INTO `disabled_clothing` VALUES (1009,'m','mask',100,-1);
INSERT INTO `disabled_clothing` VALUES (1011,'m','mask',102,-1);
INSERT INTO `disabled_clothing` VALUES (1012,'m','mask',103,-1);
INSERT INTO `disabled_clothing` VALUES (1013,'m','mask',104,-1);
INSERT INTO `disabled_clothing` VALUES (1014,'m','mask',105,-1);
INSERT INTO `disabled_clothing` VALUES (1015,'m','mask',108,-1);
INSERT INTO `disabled_clothing` VALUES (1016,'m','mask',109,-1);
INSERT INTO `disabled_clothing` VALUES (1017,'m','mask',110,-1);
INSERT INTO `disabled_clothing` VALUES (1018,'m','mask',112,-1);
INSERT INTO `disabled_clothing` VALUES (1019,'m','mask',114,-1);
INSERT INTO `disabled_clothing` VALUES (1020,'m','mask',120,-1);
INSERT INTO `disabled_clothing` VALUES (1021,'m','mask',121,-1);
INSERT INTO `disabled_clothing` VALUES (1022,'m','mask',122,-1);
INSERT INTO `disabled_clothing` VALUES (1023,'m','mask',123,-1);
INSERT INTO `disabled_clothing` VALUES (1024,'m','mask',124,-1);
INSERT INTO `disabled_clothing` VALUES (1025,'m','mask',125,-1);
INSERT INTO `disabled_clothing` VALUES (1026,'m','mask',126,-1);
INSERT INTO `disabled_clothing` VALUES (1027,'m','mask',127,-1);
INSERT INTO `disabled_clothing` VALUES (1028,'m','mask',128,-1);
INSERT INTO `disabled_clothing` VALUES (1029,'m','mask',129,-1);
INSERT INTO `disabled_clothing` VALUES (1030,'m','mask',130,-1);
INSERT INTO `disabled_clothing` VALUES (1031,'m','mask',131,-1);
INSERT INTO `disabled_clothing` VALUES (1032,'m','mask',132,-1);
INSERT INTO `disabled_clothing` VALUES (1033,'m','mask',133,-1);
INSERT INTO `disabled_clothing` VALUES (1034,'m','mask',134,-1);
INSERT INTO `disabled_clothing` VALUES (1035,'m','mask',135,-1);
INSERT INTO `disabled_clothing` VALUES (1036,'m','mask',136,-1);
INSERT INTO `disabled_clothing` VALUES (1037,'m','mask',137,-1);
INSERT INTO `disabled_clothing` VALUES (1038,'m','mask',138,-1);
INSERT INTO `disabled_clothing` VALUES (1039,'m','mask',139,-1);
INSERT INTO `disabled_clothing` VALUES (1040,'m','mask',140,-1);
INSERT INTO `disabled_clothing` VALUES (1041,'m','mask',141,-1);
INSERT INTO `disabled_clothing` VALUES (1042,'m','mask',142,-1);
INSERT INTO `disabled_clothing` VALUES (1043,'m','mask',143,-1);
INSERT INTO `disabled_clothing` VALUES (1044,'m','mask',144,-1);
INSERT INTO `disabled_clothing` VALUES (1045,'m','mask',145,-1);
INSERT INTO `disabled_clothing` VALUES (1046,'m','mask',146,-1);
INSERT INTO `disabled_clothing` VALUES (1047,'m','mask',147,-1);
INSERT INTO `disabled_clothing` VALUES (1048,'m','mask',148,-1);
INSERT INTO `disabled_clothing` VALUES (1049,'m','mask',149,-1);
INSERT INTO `disabled_clothing` VALUES (1050,'m','mask',150,-1);
INSERT INTO `disabled_clothing` VALUES (1051,'m','mask',151,-1);
INSERT INTO `disabled_clothing` VALUES (1052,'m','mask',152,-1);
INSERT INTO `disabled_clothing` VALUES (1053,'m','mask',153,-1);
INSERT INTO `disabled_clothing` VALUES (1054,'m','mask',154,-1);
INSERT INTO `disabled_clothing` VALUES (1055,'m','mask',155,-1);
INSERT INTO `disabled_clothing` VALUES (1056,'m','mask',156,-1);
INSERT INTO `disabled_clothing` VALUES (1057,'m','mask',157,-1);
INSERT INTO `disabled_clothing` VALUES (1058,'m','mask',158,-1);
INSERT INTO `disabled_clothing` VALUES (1059,'m','mask',159,-1);
INSERT INTO `disabled_clothing` VALUES (1060,'m','mask',160,-1);
INSERT INTO `disabled_clothing` VALUES (1061,'m','mask',161,-1);
INSERT INTO `disabled_clothing` VALUES (1062,'m','mask',162,-1);
INSERT INTO `disabled_clothing` VALUES (1063,'m','mask',163,-1);
INSERT INTO `disabled_clothing` VALUES (1064,'m','mask',164,-1);
INSERT INTO `disabled_clothing` VALUES (1065,'m','mask',165,-1);
INSERT INTO `disabled_clothing` VALUES (1066,'m','mask',166,-1);
INSERT INTO `disabled_clothing` VALUES (1067,'m','mask',168,-1);
INSERT INTO `disabled_clothing` VALUES (1068,'m','mask',170,-1);
INSERT INTO `disabled_clothing` VALUES (1069,'m','mask',171,-1);
INSERT INTO `disabled_clothing` VALUES (1070,'m','mask',172,-1);
INSERT INTO `disabled_clothing` VALUES (1071,'m','mask',173,-1);
INSERT INTO `disabled_clothing` VALUES (1072,'m','mask',175,-1);
INSERT INTO `disabled_clothing` VALUES (1073,'m','mask',176,-1);
INSERT INTO `disabled_clothing` VALUES (1074,'m','mask',177,-1);
INSERT INTO `disabled_clothing` VALUES (1075,'m','mask',178,-1);
INSERT INTO `disabled_clothing` VALUES (1076,'m','mask',179,-1);
INSERT INTO `disabled_clothing` VALUES (1077,'m','mask',180,-1);
INSERT INTO `disabled_clothing` VALUES (1078,'m','mask',181,-1);
INSERT INTO `disabled_clothing` VALUES (1079,'m','mask',182,-1);
INSERT INTO `disabled_clothing` VALUES (1080,'m','mask',183,-1);
INSERT INTO `disabled_clothing` VALUES (1081,'m','mask',184,-1);
INSERT INTO `disabled_clothing` VALUES (1082,'m','mask',188,-1);
INSERT INTO `disabled_clothing` VALUES (1083,'m','mask',189,-1);
INSERT INTO `disabled_clothing` VALUES (1084,'m','mask',190,-1);
INSERT INTO `disabled_clothing` VALUES (1085,'m','mask',191,-1);
INSERT INTO `disabled_clothing` VALUES (1086,'m','mask',192,-1);
INSERT INTO `disabled_clothing` VALUES (1087,'m','mask',193,-1);
INSERT INTO `disabled_clothing` VALUES (1088,'m','mask',194,-1);
INSERT INTO `disabled_clothing` VALUES (1089,'m','mask',195,-1);
INSERT INTO `disabled_clothing` VALUES (1090,'m','mask',196,-1);
INSERT INTO `disabled_clothing` VALUES (1091,'m','mask',197,-1);
INSERT INTO `disabled_clothing` VALUES (1092,'m','mask',198,-1);
INSERT INTO `disabled_clothing` VALUES (1093,'m','mask',199,-1);
INSERT INTO `disabled_clothing` VALUES (1094,'m','mask',200,-1);
INSERT INTO `disabled_clothing` VALUES (1095,'m','mask',201,-1);
INSERT INTO `disabled_clothing` VALUES (1096,'m','mask',202,-1);
INSERT INTO `disabled_clothing` VALUES (1097,'m','mask',203,-1);
INSERT INTO `disabled_clothing` VALUES (1098,'m','mask',204,-1);
INSERT INTO `disabled_clothing` VALUES (1099,'m','mask',205,-1);
INSERT INTO `disabled_clothing` VALUES (1100,'m','mask',206,-1);
INSERT INTO `disabled_clothing` VALUES (1101,'m','mask',207,-1);
INSERT INTO `disabled_clothing` VALUES (1102,'m','mask',208,-1);
INSERT INTO `disabled_clothing` VALUES (1103,'m','mask',209,-1);
INSERT INTO `disabled_clothing` VALUES (1104,'m','mask',210,-1);
INSERT INTO `disabled_clothing` VALUES (1105,'m','mask',213,-1);
INSERT INTO `disabled_clothing` VALUES (1106,'m','mask',214,-1);
INSERT INTO `disabled_clothing` VALUES (1107,'m','mask',215,-1);
INSERT INTO `disabled_clothing` VALUES (1108,'m','mask',216,-1);
INSERT INTO `disabled_clothing` VALUES (1109,'m','mask',217,-1);
INSERT INTO `disabled_clothing` VALUES (1110,'m','mask',218,-1);
INSERT INTO `disabled_clothing` VALUES (1111,'m','mask',219,-1);
INSERT INTO `disabled_clothing` VALUES (1112,'m','mask',220,-1);
INSERT INTO `disabled_clothing` VALUES (1113,'m','mask',221,-1);
INSERT INTO `disabled_clothing` VALUES (1114,'m','mask',222,-1);
INSERT INTO `disabled_clothing` VALUES (1115,'m','mask',223,-1);
INSERT INTO `disabled_clothing` VALUES (1116,'m','mask',224,-1);
INSERT INTO `disabled_clothing` VALUES (1117,'m','mask',225,-1);
INSERT INTO `disabled_clothing` VALUES (1118,'m','mask',226,-1);
INSERT INTO `disabled_clothing` VALUES (1119,'m','mask',227,-1);
INSERT INTO `disabled_clothing` VALUES (1120,'m','mask',228,-1);
INSERT INTO `disabled_clothing` VALUES (1121,'m','mask',229,-1);
INSERT INTO `disabled_clothing` VALUES (1123,'m','mask',231,-1);
INSERT INTO `disabled_clothing` VALUES (1124,'m','mask',232,-1);
INSERT INTO `disabled_clothing` VALUES (1125,'m','mask',233,-1);
INSERT INTO `disabled_clothing` VALUES (1126,'m','mask',236,-1);
INSERT INTO `disabled_clothing` VALUES (1127,'m','mask',237,-1);
INSERT INTO `disabled_clothing` VALUES (1128,'m','mask',238,-1);
INSERT INTO `disabled_clothing` VALUES (1129,'m','mask',239,-1);
INSERT INTO `disabled_clothing` VALUES (1130,'m','mask',240,-1);
INSERT INTO `disabled_clothing` VALUES (1131,'m','mask',241,-1);
INSERT INTO `disabled_clothing` VALUES (1132,'m','mask',242,-1);
INSERT INTO `disabled_clothing` VALUES (1133,'m','mask',243,-1);
INSERT INTO `disabled_clothing` VALUES (1134,'m','mask',244,-1);
INSERT INTO `disabled_clothing` VALUES (1135,'m','mask',245,-1);
INSERT INTO `disabled_clothing` VALUES (1136,'m','mask',246,-1);
INSERT INTO `disabled_clothing` VALUES (1137,'m','mask',247,-1);
INSERT INTO `disabled_clothing` VALUES (1138,'m','mask',248,-1);
INSERT INTO `disabled_clothing` VALUES (758,'m','pants',2,0);
INSERT INTO `disabled_clothing` VALUES (768,'m','pants',2,1);
INSERT INTO `disabled_clothing` VALUES (767,'m','pants',2,2);
INSERT INTO `disabled_clothing` VALUES (766,'m','pants',2,3);
INSERT INTO `disabled_clothing` VALUES (765,'m','pants',2,4);
INSERT INTO `disabled_clothing` VALUES (764,'m','pants',2,5);
INSERT INTO `disabled_clothing` VALUES (763,'m','pants',2,6);
INSERT INTO `disabled_clothing` VALUES (762,'m','pants',2,7);
INSERT INTO `disabled_clothing` VALUES (761,'m','pants',2,8);
INSERT INTO `disabled_clothing` VALUES (760,'m','pants',2,9);
INSERT INTO `disabled_clothing` VALUES (759,'m','pants',2,10);
INSERT INTO `disabled_clothing` VALUES (772,'m','pants',2,12);
INSERT INTO `disabled_clothing` VALUES (769,'m','pants',2,13);
INSERT INTO `disabled_clothing` VALUES (770,'m','pants',2,14);
INSERT INTO `disabled_clothing` VALUES (771,'m','pants',2,15);
INSERT INTO `disabled_clothing` VALUES (773,'m','pants',4,3);
INSERT INTO `disabled_clothing` VALUES (774,'m','pants',4,5);
INSERT INTO `disabled_clothing` VALUES (775,'m','pants',4,6);
INSERT INTO `disabled_clothing` VALUES (776,'m','pants',4,7);
INSERT INTO `disabled_clothing` VALUES (777,'m','pants',4,8);
INSERT INTO `disabled_clothing` VALUES (778,'m','pants',4,9);
INSERT INTO `disabled_clothing` VALUES (779,'m','pants',4,10);
INSERT INTO `disabled_clothing` VALUES (780,'m','pants',4,11);
INSERT INTO `disabled_clothing` VALUES (781,'m','pants',4,12);
INSERT INTO `disabled_clothing` VALUES (782,'m','pants',4,13);
INSERT INTO `disabled_clothing` VALUES (783,'m','pants',4,14);
INSERT INTO `disabled_clothing` VALUES (784,'m','pants',4,15);
INSERT INTO `disabled_clothing` VALUES (791,'m','pants',6,3);
INSERT INTO `disabled_clothing` VALUES (790,'m','pants',6,4);
INSERT INTO `disabled_clothing` VALUES (789,'m','pants',6,5);
INSERT INTO `disabled_clothing` VALUES (788,'m','pants',6,6);
INSERT INTO `disabled_clothing` VALUES (787,'m','pants',6,7);
INSERT INTO `disabled_clothing` VALUES (786,'m','pants',6,8);
INSERT INTO `disabled_clothing` VALUES (785,'m','pants',6,9);
INSERT INTO `disabled_clothing` VALUES (796,'m','pants',6,11);
INSERT INTO `disabled_clothing` VALUES (795,'m','pants',6,12);
INSERT INTO `disabled_clothing` VALUES (794,'m','pants',6,13);
INSERT INTO `disabled_clothing` VALUES (793,'m','pants',6,14);
INSERT INTO `disabled_clothing` VALUES (792,'m','pants',6,15);
INSERT INTO `disabled_clothing` VALUES (588,'m','pants',8,1);
INSERT INTO `disabled_clothing` VALUES (589,'m','pants',8,2);
INSERT INTO `disabled_clothing` VALUES (590,'m','pants',8,5);
INSERT INTO `disabled_clothing` VALUES (592,'m','pants',8,6);
INSERT INTO `disabled_clothing` VALUES (591,'m','pants',8,7);
INSERT INTO `disabled_clothing` VALUES (593,'m','pants',8,8);
INSERT INTO `disabled_clothing` VALUES (594,'m','pants',8,9);
INSERT INTO `disabled_clothing` VALUES (595,'m','pants',8,10);
INSERT INTO `disabled_clothing` VALUES (596,'m','pants',8,11);
INSERT INTO `disabled_clothing` VALUES (597,'m','pants',8,12);
INSERT INTO `disabled_clothing` VALUES (598,'m','pants',8,13);
INSERT INTO `disabled_clothing` VALUES (599,'m','pants',8,15);
INSERT INTO `disabled_clothing` VALUES (600,'m','pants',10,4);
INSERT INTO `disabled_clothing` VALUES (601,'m','pants',10,5);
INSERT INTO `disabled_clothing` VALUES (602,'m','pants',10,6);
INSERT INTO `disabled_clothing` VALUES (603,'m','pants',10,7);
INSERT INTO `disabled_clothing` VALUES (604,'m','pants',10,8);
INSERT INTO `disabled_clothing` VALUES (605,'m','pants',10,9);
INSERT INTO `disabled_clothing` VALUES (606,'m','pants',10,10);
INSERT INTO `disabled_clothing` VALUES (607,'m','pants',10,11);
INSERT INTO `disabled_clothing` VALUES (608,'m','pants',10,12);
INSERT INTO `disabled_clothing` VALUES (609,'m','pants',10,13);
INSERT INTO `disabled_clothing` VALUES (610,'m','pants',10,14);
INSERT INTO `disabled_clothing` VALUES (611,'m','pants',10,15);
INSERT INTO `disabled_clothing` VALUES (612,'m','pants',11,-1);
INSERT INTO `disabled_clothing` VALUES (613,'m','pants',12,1);
INSERT INTO `disabled_clothing` VALUES (614,'m','pants',12,2);
INSERT INTO `disabled_clothing` VALUES (615,'m','pants',12,3);
INSERT INTO `disabled_clothing` VALUES (616,'m','pants',12,6);
INSERT INTO `disabled_clothing` VALUES (617,'m','pants',12,8);
INSERT INTO `disabled_clothing` VALUES (618,'m','pants',12,9);
INSERT INTO `disabled_clothing` VALUES (619,'m','pants',12,10);
INSERT INTO `disabled_clothing` VALUES (620,'m','pants',12,11);
INSERT INTO `disabled_clothing` VALUES (621,'m','pants',12,13);
INSERT INTO `disabled_clothing` VALUES (622,'m','pants',12,14);
INSERT INTO `disabled_clothing` VALUES (623,'m','pants',12,15);
INSERT INTO `disabled_clothing` VALUES (624,'m','pants',13,3);
INSERT INTO `disabled_clothing` VALUES (625,'m','pants',13,4);
INSERT INTO `disabled_clothing` VALUES (626,'m','pants',13,5);
INSERT INTO `disabled_clothing` VALUES (627,'m','pants',13,6);
INSERT INTO `disabled_clothing` VALUES (628,'m','pants',13,7);
INSERT INTO `disabled_clothing` VALUES (629,'m','pants',13,8);
INSERT INTO `disabled_clothing` VALUES (630,'m','pants',13,9);
INSERT INTO `disabled_clothing` VALUES (631,'m','pants',13,10);
INSERT INTO `disabled_clothing` VALUES (632,'m','pants',13,11);
INSERT INTO `disabled_clothing` VALUES (633,'m','pants',13,12);
INSERT INTO `disabled_clothing` VALUES (634,'m','pants',13,13);
INSERT INTO `disabled_clothing` VALUES (635,'m','pants',13,14);
INSERT INTO `disabled_clothing` VALUES (636,'m','pants',13,15);
INSERT INTO `disabled_clothing` VALUES (637,'m','pants',14,2);
INSERT INTO `disabled_clothing` VALUES (638,'m','pants',14,4);
INSERT INTO `disabled_clothing` VALUES (639,'m','pants',14,5);
INSERT INTO `disabled_clothing` VALUES (640,'m','pants',14,6);
INSERT INTO `disabled_clothing` VALUES (641,'m','pants',14,7);
INSERT INTO `disabled_clothing` VALUES (642,'m','pants',14,8);
INSERT INTO `disabled_clothing` VALUES (643,'m','pants',14,9);
INSERT INTO `disabled_clothing` VALUES (644,'m','pants',14,10);
INSERT INTO `disabled_clothing` VALUES (645,'m','pants',14,11);
INSERT INTO `disabled_clothing` VALUES (646,'m','pants',14,13);
INSERT INTO `disabled_clothing` VALUES (647,'m','pants',14,14);
INSERT INTO `disabled_clothing` VALUES (648,'m','pants',14,15);
INSERT INTO `disabled_clothing` VALUES (649,'m','pants',21,-1);
INSERT INTO `disabled_clothing` VALUES (650,'m','pants',33,-1);
INSERT INTO `disabled_clothing` VALUES (651,'m','pants',34,-1);
INSERT INTO `disabled_clothing` VALUES (652,'m','pants',40,-1);
INSERT INTO `disabled_clothing` VALUES (653,'m','pants',41,-1);
INSERT INTO `disabled_clothing` VALUES (654,'m','pants',44,-1);
INSERT INTO `disabled_clothing` VALUES (655,'m','pants',46,-1);
INSERT INTO `disabled_clothing` VALUES (656,'m','pants',57,-1);
INSERT INTO `disabled_clothing` VALUES (657,'m','pants',59,-1);
INSERT INTO `disabled_clothing` VALUES (658,'m','pants',66,-1);
INSERT INTO `disabled_clothing` VALUES (659,'m','pants',67,-1);
INSERT INTO `disabled_clothing` VALUES (660,'m','pants',68,-1);
INSERT INTO `disabled_clothing` VALUES (661,'m','pants',70,-1);
INSERT INTO `disabled_clothing` VALUES (662,'m','pants',72,-1);
INSERT INTO `disabled_clothing` VALUES (663,'m','pants',74,-1);
INSERT INTO `disabled_clothing` VALUES (664,'m','pants',77,-1);
INSERT INTO `disabled_clothing` VALUES (665,'m','pants',84,-1);
INSERT INTO `disabled_clothing` VALUES (666,'m','pants',85,-1);
INSERT INTO `disabled_clothing` VALUES (667,'m','pants',87,-1);
INSERT INTO `disabled_clothing` VALUES (668,'m','pants',91,-1);
INSERT INTO `disabled_clothing` VALUES (669,'m','pants',92,-1);
INSERT INTO `disabled_clothing` VALUES (670,'m','pants',95,-1);
INSERT INTO `disabled_clothing` VALUES (671,'m','pants',97,-1);
INSERT INTO `disabled_clothing` VALUES (672,'m','pants',99,-1);
INSERT INTO `disabled_clothing` VALUES (673,'m','pants',101,-1);
INSERT INTO `disabled_clothing` VALUES (674,'m','pants',106,-1);
INSERT INTO `disabled_clothing` VALUES (675,'m','pants',107,-1);
INSERT INTO `disabled_clothing` VALUES (676,'m','pants',108,-1);
INSERT INTO `disabled_clothing` VALUES (677,'m','pants',109,-1);
INSERT INTO `disabled_clothing` VALUES (678,'m','pants',110,-1);
INSERT INTO `disabled_clothing` VALUES (679,'m','pants',111,-1);
INSERT INTO `disabled_clothing` VALUES (680,'m','pants',112,-1);
INSERT INTO `disabled_clothing` VALUES (681,'m','pants',113,-1);
INSERT INTO `disabled_clothing` VALUES (682,'m','pants',114,-1);
INSERT INTO `disabled_clothing` VALUES (683,'m','pants',115,-1);
INSERT INTO `disabled_clothing` VALUES (684,'m','pants',120,-1);
INSERT INTO `disabled_clothing` VALUES (685,'m','pants',121,-1);
INSERT INTO `disabled_clothing` VALUES (686,'m','pants',123,-1);
INSERT INTO `disabled_clothing` VALUES (687,'m','pants',127,-1);
INSERT INTO `disabled_clothing` VALUES (688,'m','pants',130,-1);
INSERT INTO `disabled_clothing` VALUES (689,'m','pants',131,-1);
INSERT INTO `disabled_clothing` VALUES (690,'m','pants',133,-1);
INSERT INTO `disabled_clothing` VALUES (691,'m','pants',134,-1);
INSERT INTO `disabled_clothing` VALUES (692,'m','pants',135,-1);
INSERT INTO `disabled_clothing` VALUES (693,'m','pants',137,-1);
INSERT INTO `disabled_clothing` VALUES (694,'m','pants',145,-1);
INSERT INTO `disabled_clothing` VALUES (695,'m','pants',146,-1);
INSERT INTO `disabled_clothing` VALUES (696,'m','pants',152,-1);
INSERT INTO `disabled_clothing` VALUES (697,'m','pants',153,-1);
INSERT INTO `disabled_clothing` VALUES (698,'m','pants',157,-1);
INSERT INTO `disabled_clothing` VALUES (699,'m','pants',158,-1);
INSERT INTO `disabled_clothing` VALUES (700,'m','pants',159,-1);
INSERT INTO `disabled_clothing` VALUES (701,'m','pants',160,-1);
INSERT INTO `disabled_clothing` VALUES (702,'m','pants',161,-1);
INSERT INTO `disabled_clothing` VALUES (703,'m','pants',162,-1);
INSERT INTO `disabled_clothing` VALUES (704,'m','pants',163,-1);
INSERT INTO `disabled_clothing` VALUES (705,'m','pants',164,-1);
INSERT INTO `disabled_clothing` VALUES (706,'m','pants',165,-1);
INSERT INTO `disabled_clothing` VALUES (707,'m','pants',166,-1);
INSERT INTO `disabled_clothing` VALUES (708,'m','pants',167,-1);
INSERT INTO `disabled_clothing` VALUES (709,'m','pants',168,-1);
INSERT INTO `disabled_clothing` VALUES (710,'m','pants',169,-1);
INSERT INTO `disabled_clothing` VALUES (711,'m','pants',171,-1);
INSERT INTO `disabled_clothing` VALUES (712,'m','pants',175,-1);
INSERT INTO `disabled_clothing` VALUES (713,'m','pants',177,-1);
INSERT INTO `disabled_clothing` VALUES (714,'m','pants',178,-1);
INSERT INTO `disabled_clothing` VALUES (715,'m','pants',179,-1);
INSERT INTO `disabled_clothing` VALUES (716,'m','pants',180,-1);
INSERT INTO `disabled_clothing` VALUES (717,'m','pants',181,-1);
INSERT INTO `disabled_clothing` VALUES (718,'m','pants',182,-1);
INSERT INTO `disabled_clothing` VALUES (719,'m','pants',183,-1);
INSERT INTO `disabled_clothing` VALUES (720,'m','pants',184,-1);
INSERT INTO `disabled_clothing` VALUES (721,'m','pants',185,-1);
INSERT INTO `disabled_clothing` VALUES (722,'m','pants',186,-1);
INSERT INTO `disabled_clothing` VALUES (723,'m','pants',188,-1);
INSERT INTO `disabled_clothing` VALUES (724,'m','pants',189,-1);
INSERT INTO `disabled_clothing` VALUES (725,'m','pants',190,-1);
INSERT INTO `disabled_clothing` VALUES (726,'m','pants',191,-1);
INSERT INTO `disabled_clothing` VALUES (727,'m','pants',192,-1);
INSERT INTO `disabled_clothing` VALUES (728,'m','pants',193,-1);
INSERT INTO `disabled_clothing` VALUES (729,'m','pants',194,-1);
INSERT INTO `disabled_clothing` VALUES (730,'m','pants',195,-1);
INSERT INTO `disabled_clothing` VALUES (731,'m','pants',197,-1);
INSERT INTO `disabled_clothing` VALUES (732,'m','pants',198,-1);
INSERT INTO `disabled_clothing` VALUES (733,'m','pants',199,-1);
INSERT INTO `disabled_clothing` VALUES (734,'m','pants',200,-1);
INSERT INTO `disabled_clothing` VALUES (735,'m','pants',202,-1);
INSERT INTO `disabled_clothing` VALUES (736,'m','pants',203,-1);
INSERT INTO `disabled_clothing` VALUES (737,'m','pants',204,-1);
INSERT INTO `disabled_clothing` VALUES (738,'m','pants',205,-1);
INSERT INTO `disabled_clothing` VALUES (739,'m','pants',206,-1);
INSERT INTO `disabled_clothing` VALUES (740,'m','pants',207,-1);
INSERT INTO `disabled_clothing` VALUES (741,'m','pants',209,-1);
INSERT INTO `disabled_clothing` VALUES (742,'m','pants',211,-1);
INSERT INTO `disabled_clothing` VALUES (743,'m','pants',214,-1);
INSERT INTO `disabled_clothing` VALUES (744,'m','pants',215,-1);
INSERT INTO `disabled_clothing` VALUES (745,'m','pants',216,-1);
INSERT INTO `disabled_clothing` VALUES (746,'m','pants',217,-1);
INSERT INTO `disabled_clothing` VALUES (747,'m','pants',218,-1);
INSERT INTO `disabled_clothing` VALUES (748,'m','pants',219,-1);
INSERT INTO `disabled_clothing` VALUES (749,'m','pants',220,-1);
INSERT INTO `disabled_clothing` VALUES (750,'m','pants',221,-1);
INSERT INTO `disabled_clothing` VALUES (751,'m','pants',222,-1);
INSERT INTO `disabled_clothing` VALUES (752,'m','pants',225,-1);
INSERT INTO `disabled_clothing` VALUES (753,'m','pants',226,-1);
INSERT INTO `disabled_clothing` VALUES (754,'m','pants',227,-1);
INSERT INTO `disabled_clothing` VALUES (755,'m','pants',228,-1);
INSERT INTO `disabled_clothing` VALUES (756,'m','pants',233,1);
INSERT INTO `disabled_clothing` VALUES (757,'m','pants',234,-1);
INSERT INTO `disabled_clothing` VALUES (898,'m','shoes',0,0);
INSERT INTO `disabled_clothing` VALUES (899,'m','shoes',0,1);
INSERT INTO `disabled_clothing` VALUES (900,'m','shoes',0,2);
INSERT INTO `disabled_clothing` VALUES (901,'m','shoes',0,3);
INSERT INTO `disabled_clothing` VALUES (902,'m','shoes',0,4);
INSERT INTO `disabled_clothing` VALUES (903,'m','shoes',0,5);
INSERT INTO `disabled_clothing` VALUES (904,'m','shoes',0,6);
INSERT INTO `disabled_clothing` VALUES (905,'m','shoes',0,7);
INSERT INTO `disabled_clothing` VALUES (906,'m','shoes',0,8);
INSERT INTO `disabled_clothing` VALUES (907,'m','shoes',0,9);
INSERT INTO `disabled_clothing` VALUES (908,'m','shoes',0,11);
INSERT INTO `disabled_clothing` VALUES (909,'m','shoes',0,12);
INSERT INTO `disabled_clothing` VALUES (910,'m','shoes',0,13);
INSERT INTO `disabled_clothing` VALUES (911,'m','shoes',0,14);
INSERT INTO `disabled_clothing` VALUES (912,'m','shoes',0,15);
INSERT INTO `disabled_clothing` VALUES (797,'m','shoes',2,0);
INSERT INTO `disabled_clothing` VALUES (798,'m','shoes',2,1);
INSERT INTO `disabled_clothing` VALUES (799,'m','shoes',2,2);
INSERT INTO `disabled_clothing` VALUES (800,'m','shoes',2,3);
INSERT INTO `disabled_clothing` VALUES (801,'m','shoes',2,4);
INSERT INTO `disabled_clothing` VALUES (802,'m','shoes',2,5);
INSERT INTO `disabled_clothing` VALUES (803,'m','shoes',2,7);
INSERT INTO `disabled_clothing` VALUES (804,'m','shoes',2,8);
INSERT INTO `disabled_clothing` VALUES (805,'m','shoes',2,9);
INSERT INTO `disabled_clothing` VALUES (806,'m','shoes',2,10);
INSERT INTO `disabled_clothing` VALUES (807,'m','shoes',2,11);
INSERT INTO `disabled_clothing` VALUES (808,'m','shoes',2,12);
INSERT INTO `disabled_clothing` VALUES (809,'m','shoes',2,14);
INSERT INTO `disabled_clothing` VALUES (810,'m','shoes',2,15);
INSERT INTO `disabled_clothing` VALUES (811,'m','shoes',4,3);
INSERT INTO `disabled_clothing` VALUES (812,'m','shoes',4,5);
INSERT INTO `disabled_clothing` VALUES (813,'m','shoes',4,6);
INSERT INTO `disabled_clothing` VALUES (814,'m','shoes',4,7);
INSERT INTO `disabled_clothing` VALUES (815,'m','shoes',4,8);
INSERT INTO `disabled_clothing` VALUES (816,'m','shoes',4,9);
INSERT INTO `disabled_clothing` VALUES (817,'m','shoes',4,10);
INSERT INTO `disabled_clothing` VALUES (818,'m','shoes',4,11);
INSERT INTO `disabled_clothing` VALUES (819,'m','shoes',4,12);
INSERT INTO `disabled_clothing` VALUES (820,'m','shoes',4,13);
INSERT INTO `disabled_clothing` VALUES (821,'m','shoes',4,14);
INSERT INTO `disabled_clothing` VALUES (822,'m','shoes',4,15);
INSERT INTO `disabled_clothing` VALUES (823,'m','shoes',5,4);
INSERT INTO `disabled_clothing` VALUES (824,'m','shoes',5,5);
INSERT INTO `disabled_clothing` VALUES (825,'m','shoes',5,6);
INSERT INTO `disabled_clothing` VALUES (826,'m','shoes',5,7);
INSERT INTO `disabled_clothing` VALUES (827,'m','shoes',5,8);
INSERT INTO `disabled_clothing` VALUES (828,'m','shoes',5,9);
INSERT INTO `disabled_clothing` VALUES (829,'m','shoes',5,10);
INSERT INTO `disabled_clothing` VALUES (830,'m','shoes',5,11);
INSERT INTO `disabled_clothing` VALUES (831,'m','shoes',5,12);
INSERT INTO `disabled_clothing` VALUES (832,'m','shoes',5,13);
INSERT INTO `disabled_clothing` VALUES (833,'m','shoes',5,14);
INSERT INTO `disabled_clothing` VALUES (834,'m','shoes',5,15);
INSERT INTO `disabled_clothing` VALUES (835,'m','shoes',6,2);
INSERT INTO `disabled_clothing` VALUES (836,'m','shoes',6,3);
INSERT INTO `disabled_clothing` VALUES (837,'m','shoes',6,4);
INSERT INTO `disabled_clothing` VALUES (838,'m','shoes',6,5);
INSERT INTO `disabled_clothing` VALUES (839,'m','shoes',6,6);
INSERT INTO `disabled_clothing` VALUES (840,'m','shoes',6,7);
INSERT INTO `disabled_clothing` VALUES (841,'m','shoes',6,8);
INSERT INTO `disabled_clothing` VALUES (842,'m','shoes',6,9);
INSERT INTO `disabled_clothing` VALUES (843,'m','shoes',6,10);
INSERT INTO `disabled_clothing` VALUES (844,'m','shoes',6,11);
INSERT INTO `disabled_clothing` VALUES (845,'m','shoes',6,12);
INSERT INTO `disabled_clothing` VALUES (846,'m','shoes',6,13);
INSERT INTO `disabled_clothing` VALUES (847,'m','shoes',6,14);
INSERT INTO `disabled_clothing` VALUES (848,'m','shoes',6,15);
INSERT INTO `disabled_clothing` VALUES (849,'m','shoes',10,1);
INSERT INTO `disabled_clothing` VALUES (850,'m','shoes',10,2);
INSERT INTO `disabled_clothing` VALUES (851,'m','shoes',10,3);
INSERT INTO `disabled_clothing` VALUES (852,'m','shoes',10,4);
INSERT INTO `disabled_clothing` VALUES (853,'m','shoes',10,5);
INSERT INTO `disabled_clothing` VALUES (854,'m','shoes',10,6);
INSERT INTO `disabled_clothing` VALUES (855,'m','shoes',10,8);
INSERT INTO `disabled_clothing` VALUES (856,'m','shoes',10,9);
INSERT INTO `disabled_clothing` VALUES (857,'m','shoes',10,10);
INSERT INTO `disabled_clothing` VALUES (858,'m','shoes',10,11);
INSERT INTO `disabled_clothing` VALUES (859,'m','shoes',10,13);
INSERT INTO `disabled_clothing` VALUES (860,'m','shoes',10,15);
INSERT INTO `disabled_clothing` VALUES (861,'m','shoes',11,0);
INSERT INTO `disabled_clothing` VALUES (862,'m','shoes',11,1);
INSERT INTO `disabled_clothing` VALUES (863,'m','shoes',11,2);
INSERT INTO `disabled_clothing` VALUES (864,'m','shoes',11,3);
INSERT INTO `disabled_clothing` VALUES (865,'m','shoes',11,4);
INSERT INTO `disabled_clothing` VALUES (866,'m','shoes',11,5);
INSERT INTO `disabled_clothing` VALUES (867,'m','shoes',11,6);
INSERT INTO `disabled_clothing` VALUES (868,'m','shoes',11,7);
INSERT INTO `disabled_clothing` VALUES (869,'m','shoes',11,8);
INSERT INTO `disabled_clothing` VALUES (870,'m','shoes',11,10);
INSERT INTO `disabled_clothing` VALUES (871,'m','shoes',11,11);
INSERT INTO `disabled_clothing` VALUES (872,'m','shoes',11,13);
INSERT INTO `disabled_clothing` VALUES (873,'m','shoes',13,-1);
INSERT INTO `disabled_clothing` VALUES (874,'m','shoes',33,-1);
INSERT INTO `disabled_clothing` VALUES (875,'m','shoes',34,-1);
INSERT INTO `disabled_clothing` VALUES (876,'m','shoes',39,-1);
INSERT INTO `disabled_clothing` VALUES (877,'m','shoes',47,-1);
INSERT INTO `disabled_clothing` VALUES (878,'m','shoes',67,-1);
INSERT INTO `disabled_clothing` VALUES (879,'m','shoes',68,-1);
INSERT INTO `disabled_clothing` VALUES (880,'m','shoes',69,-1);
INSERT INTO `disabled_clothing` VALUES (881,'m','shoes',78,-1);
INSERT INTO `disabled_clothing` VALUES (882,'m','shoes',83,-1);
INSERT INTO `disabled_clothing` VALUES (883,'m','shoes',84,-1);
INSERT INTO `disabled_clothing` VALUES (884,'m','shoes',85,-1);
INSERT INTO `disabled_clothing` VALUES (886,'m','shoes',90,-1);
INSERT INTO `disabled_clothing` VALUES (885,'m','shoes',91,-1);
INSERT INTO `disabled_clothing` VALUES (887,'m','shoes',100,-1);
INSERT INTO `disabled_clothing` VALUES (888,'m','shoes',105,-1);
INSERT INTO `disabled_clothing` VALUES (889,'m','shoes',111,-1);
INSERT INTO `disabled_clothing` VALUES (890,'m','shoes',113,-1);
INSERT INTO `disabled_clothing` VALUES (891,'m','shoes',117,-1);
INSERT INTO `disabled_clothing` VALUES (892,'m','shoes',121,-1);
INSERT INTO `disabled_clothing` VALUES (893,'m','shoes',125,-1);
INSERT INTO `disabled_clothing` VALUES (894,'m','shoes',127,-1);
INSERT INTO `disabled_clothing` VALUES (895,'m','shoes',128,-1);
INSERT INTO `disabled_clothing` VALUES (896,'m','shoes',129,-1);
INSERT INTO `disabled_clothing` VALUES (897,'m','shoes',130,-1);
INSERT INTO `disabled_clothing` VALUES (920,'m','shoes',140,-1);
INSERT INTO `disabled_clothing` VALUES (919,'m','shoes',141,-1);
INSERT INTO `disabled_clothing` VALUES (918,'m','shoes',142,-1);
INSERT INTO `disabled_clothing` VALUES (917,'m','shoes',143,-1);
INSERT INTO `disabled_clothing` VALUES (916,'m','shoes',144,-1);
INSERT INTO `disabled_clothing` VALUES (915,'m','shoes',147,-1);
INSERT INTO `disabled_clothing` VALUES (914,'m','shoes',160,-1);
INSERT INTO `disabled_clothing` VALUES (913,'m','shoes',161,-1);
INSERT INTO `disabled_clothing` VALUES (1,'m','top',0,6);
INSERT INTO `disabled_clothing` VALUES (2,'m','top',0,9);
INSERT INTO `disabled_clothing` VALUES (3,'m','top',0,10);
INSERT INTO `disabled_clothing` VALUES (4,'m','top',0,12);
INSERT INTO `disabled_clothing` VALUES (5,'m','top',0,13);
INSERT INTO `disabled_clothing` VALUES (6,'m','top',0,14);
INSERT INTO `disabled_clothing` VALUES (7,'m','top',0,15);
INSERT INTO `disabled_clothing` VALUES (8,'m','top',1,2);
INSERT INTO `disabled_clothing` VALUES (9,'m','top',1,9);
INSERT INTO `disabled_clothing` VALUES (10,'m','top',1,10);
INSERT INTO `disabled_clothing` VALUES (11,'m','top',1,13);
INSERT INTO `disabled_clothing` VALUES (12,'m','top',1,15);
INSERT INTO `disabled_clothing` VALUES (376,'m','top',2,-1);
INSERT INTO `disabled_clothing` VALUES (13,'m','top',2,0);
INSERT INTO `disabled_clothing` VALUES (14,'m','top',2,1);
INSERT INTO `disabled_clothing` VALUES (15,'m','top',2,2);
INSERT INTO `disabled_clothing` VALUES (16,'m','top',2,3);
INSERT INTO `disabled_clothing` VALUES (17,'m','top',2,4);
INSERT INTO `disabled_clothing` VALUES (18,'m','top',2,5);
INSERT INTO `disabled_clothing` VALUES (19,'m','top',2,6);
INSERT INTO `disabled_clothing` VALUES (20,'m','top',2,7);
INSERT INTO `disabled_clothing` VALUES (21,'m','top',2,8);
INSERT INTO `disabled_clothing` VALUES (22,'m','top',2,9);
INSERT INTO `disabled_clothing` VALUES (23,'m','top',2,10);
INSERT INTO `disabled_clothing` VALUES (24,'m','top',2,11);
INSERT INTO `disabled_clothing` VALUES (25,'m','top',2,12);
INSERT INTO `disabled_clothing` VALUES (26,'m','top',2,13);
INSERT INTO `disabled_clothing` VALUES (27,'m','top',2,14);
INSERT INTO `disabled_clothing` VALUES (28,'m','top',2,15);
INSERT INTO `disabled_clothing` VALUES (375,'m','top',3,-1);
INSERT INTO `disabled_clothing` VALUES (374,'m','top',4,-1);
INSERT INTO `disabled_clothing` VALUES (29,'m','top',4,1);
INSERT INTO `disabled_clothing` VALUES (30,'m','top',4,4);
INSERT INTO `disabled_clothing` VALUES (31,'m','top',4,5);
INSERT INTO `disabled_clothing` VALUES (32,'m','top',4,6);
INSERT INTO `disabled_clothing` VALUES (33,'m','top',4,7);
INSERT INTO `disabled_clothing` VALUES (34,'m','top',4,8);
INSERT INTO `disabled_clothing` VALUES (35,'m','top',4,9);
INSERT INTO `disabled_clothing` VALUES (36,'m','top',4,10);
INSERT INTO `disabled_clothing` VALUES (37,'m','top',4,12);
INSERT INTO `disabled_clothing` VALUES (38,'m','top',4,13);
INSERT INTO `disabled_clothing` VALUES (39,'m','top',4,15);
INSERT INTO `disabled_clothing` VALUES (373,'m','top',5,-1);
INSERT INTO `disabled_clothing` VALUES (40,'m','top',5,0);
INSERT INTO `disabled_clothing` VALUES (41,'m','top',5,1);
INSERT INTO `disabled_clothing` VALUES (372,'m','top',6,-1);
INSERT INTO `disabled_clothing` VALUES (371,'m','top',7,-1);
INSERT INTO `disabled_clothing` VALUES (370,'m','top',8,-1);
INSERT INTO `disabled_clothing` VALUES (369,'m','top',10,-1);
INSERT INTO `disabled_clothing` VALUES (368,'m','top',11,-1);
INSERT INTO `disabled_clothing` VALUES (367,'m','top',12,-1);
INSERT INTO `disabled_clothing` VALUES (366,'m','top',15,-1);
INSERT INTO `disabled_clothing` VALUES (365,'m','top',19,-1);
INSERT INTO `disabled_clothing` VALUES (364,'m','top',20,-1);
INSERT INTO `disabled_clothing` VALUES (42,'m','top',21,-1);
INSERT INTO `disabled_clothing` VALUES (363,'m','top',23,-1);
INSERT INTO `disabled_clothing` VALUES (362,'m','top',24,-1);
INSERT INTO `disabled_clothing` VALUES (43,'m','top',25,-1);
INSERT INTO `disabled_clothing` VALUES (361,'m','top',26,-1);
INSERT INTO `disabled_clothing` VALUES (360,'m','top',27,-1);
INSERT INTO `disabled_clothing` VALUES (359,'m','top',28,-1);
INSERT INTO `disabled_clothing` VALUES (358,'m','top',29,-1);
INSERT INTO `disabled_clothing` VALUES (357,'m','top',30,-1);
INSERT INTO `disabled_clothing` VALUES (44,'m','top',31,-1);
INSERT INTO `disabled_clothing` VALUES (45,'m','top',32,-1);
INSERT INTO `disabled_clothing` VALUES (46,'m','top',35,-1);
INSERT INTO `disabled_clothing` VALUES (47,'m','top',37,-1);
INSERT INTO `disabled_clothing` VALUES (48,'m','top',40,-1);
INSERT INTO `disabled_clothing` VALUES (49,'m','top',45,-1);
INSERT INTO `disabled_clothing` VALUES (50,'m','top',46,-1);
INSERT INTO `disabled_clothing` VALUES (71,'m','top',48,-1);
INSERT INTO `disabled_clothing` VALUES (70,'m','top',49,-1);
INSERT INTO `disabled_clothing` VALUES (69,'m','top',50,-1);
INSERT INTO `disabled_clothing` VALUES (53,'m','top',53,-1);
INSERT INTO `disabled_clothing` VALUES (52,'m','top',54,-1);
INSERT INTO `disabled_clothing` VALUES (51,'m','top',55,-1);
INSERT INTO `disabled_clothing` VALUES (54,'m','top',58,-1);
INSERT INTO `disabled_clothing` VALUES (55,'m','top',59,-1);
INSERT INTO `disabled_clothing` VALUES (56,'m','top',60,-1);
INSERT INTO `disabled_clothing` VALUES (57,'m','top',61,-1);
INSERT INTO `disabled_clothing` VALUES (58,'m','top',62,-1);
INSERT INTO `disabled_clothing` VALUES (59,'m','top',64,-1);
INSERT INTO `disabled_clothing` VALUES (60,'m','top',65,-1);
INSERT INTO `disabled_clothing` VALUES (61,'m','top',66,-1);
INSERT INTO `disabled_clothing` VALUES (62,'m','top',67,-1);
INSERT INTO `disabled_clothing` VALUES (63,'m','top',68,-1);
INSERT INTO `disabled_clothing` VALUES (64,'m','top',69,-1);
INSERT INTO `disabled_clothing` VALUES (65,'m','top',70,-1);
INSERT INTO `disabled_clothing` VALUES (66,'m','top',72,-1);
INSERT INTO `disabled_clothing` VALUES (67,'m','top',74,-1);
INSERT INTO `disabled_clothing` VALUES (68,'m','top',77,-1);
INSERT INTO `disabled_clothing` VALUES (72,'m','top',88,-1);
INSERT INTO `disabled_clothing` VALUES (73,'m','top',91,-1);
INSERT INTO `disabled_clothing` VALUES (74,'m','top',98,-1);
INSERT INTO `disabled_clothing` VALUES (75,'m','top',99,-1);
INSERT INTO `disabled_clothing` VALUES (76,'m','top',100,-1);
INSERT INTO `disabled_clothing` VALUES (77,'m','top',101,-1);
INSERT INTO `disabled_clothing` VALUES (78,'m','top',102,-1);
INSERT INTO `disabled_clothing` VALUES (79,'m','top',103,-1);
INSERT INTO `disabled_clothing` VALUES (80,'m','top',104,-1);
INSERT INTO `disabled_clothing` VALUES (81,'m','top',106,-1);
INSERT INTO `disabled_clothing` VALUES (82,'m','top',109,-1);
INSERT INTO `disabled_clothing` VALUES (83,'m','top',110,-1);
INSERT INTO `disabled_clothing` VALUES (84,'m','top',112,-1);
INSERT INTO `disabled_clothing` VALUES (85,'m','top',114,-1);
INSERT INTO `disabled_clothing` VALUES (86,'m','top',115,-1);
INSERT INTO `disabled_clothing` VALUES (87,'m','top',118,-1);
INSERT INTO `disabled_clothing` VALUES (88,'m','top',119,-1);
INSERT INTO `disabled_clothing` VALUES (89,'m','top',120,-1);
INSERT INTO `disabled_clothing` VALUES (90,'m','top',121,-1);
INSERT INTO `disabled_clothing` VALUES (91,'m','top',122,-1);
INSERT INTO `disabled_clothing` VALUES (92,'m','top',124,-1);
INSERT INTO `disabled_clothing` VALUES (93,'m','top',127,-1);
INSERT INTO `disabled_clothing` VALUES (94,'m','top',130,-1);
INSERT INTO `disabled_clothing` VALUES (95,'m','top',136,-1);
INSERT INTO `disabled_clothing` VALUES (96,'m','top',137,-1);
INSERT INTO `disabled_clothing` VALUES (97,'m','top',138,-1);
INSERT INTO `disabled_clothing` VALUES (98,'m','top',140,-1);
INSERT INTO `disabled_clothing` VALUES (99,'m','top',142,-1);
INSERT INTO `disabled_clothing` VALUES (356,'m','top',147,-1);
INSERT INTO `disabled_clothing` VALUES (100,'m','top',151,-1);
INSERT INTO `disabled_clothing` VALUES (101,'m','top',156,-1);
INSERT INTO `disabled_clothing` VALUES (102,'m','top',163,-1);
INSERT INTO `disabled_clothing` VALUES (103,'m','top',166,-1);
INSERT INTO `disabled_clothing` VALUES (104,'m','top',167,-1);
INSERT INTO `disabled_clothing` VALUES (105,'m','top',169,-1);
INSERT INTO `disabled_clothing` VALUES (106,'m','top',172,-1);
INSERT INTO `disabled_clothing` VALUES (107,'m','top',181,-1);
INSERT INTO `disabled_clothing` VALUES (108,'m','top',183,-1);
INSERT INTO `disabled_clothing` VALUES (109,'m','top',185,-1);
INSERT INTO `disabled_clothing` VALUES (110,'m','top',186,-1);
INSERT INTO `disabled_clothing` VALUES (111,'m','top',189,-1);
INSERT INTO `disabled_clothing` VALUES (112,'m','top',191,-1);
INSERT INTO `disabled_clothing` VALUES (113,'m','top',192,-1);
INSERT INTO `disabled_clothing` VALUES (114,'m','top',212,-1);
INSERT INTO `disabled_clothing` VALUES (115,'m','top',215,-1);
INSERT INTO `disabled_clothing` VALUES (116,'m','top',228,-1);
INSERT INTO `disabled_clothing` VALUES (117,'m','top',228,1);
INSERT INTO `disabled_clothing` VALUES (118,'m','top',230,-1);
INSERT INTO `disabled_clothing` VALUES (119,'m','top',231,-1);
INSERT INTO `disabled_clothing` VALUES (120,'m','top',233,-1);
INSERT INTO `disabled_clothing` VALUES (121,'m','top',240,-1);
INSERT INTO `disabled_clothing` VALUES (122,'m','top',246,-1);
INSERT INTO `disabled_clothing` VALUES (123,'m','top',252,-1);
INSERT INTO `disabled_clothing` VALUES (124,'m','top',261,-1);
INSERT INTO `disabled_clothing` VALUES (125,'m','top',266,-1);
INSERT INTO `disabled_clothing` VALUES (126,'m','top',269,-1);
INSERT INTO `disabled_clothing` VALUES (127,'m','top',270,-1);
INSERT INTO `disabled_clothing` VALUES (128,'m','top',274,-1);
INSERT INTO `disabled_clothing` VALUES (129,'m','top',275,-1);
INSERT INTO `disabled_clothing` VALUES (130,'m','top',276,-1);
INSERT INTO `disabled_clothing` VALUES (131,'m','top',278,-1);
INSERT INTO `disabled_clothing` VALUES (132,'m','top',283,-1);
INSERT INTO `disabled_clothing` VALUES (133,'m','top',284,-1);
INSERT INTO `disabled_clothing` VALUES (134,'m','top',285,-1);
INSERT INTO `disabled_clothing` VALUES (135,'m','top',286,-1);
INSERT INTO `disabled_clothing` VALUES (136,'m','top',287,-1);
INSERT INTO `disabled_clothing` VALUES (137,'m','top',289,-1);
INSERT INTO `disabled_clothing` VALUES (138,'m','top',290,-1);
INSERT INTO `disabled_clothing` VALUES (139,'m','top',291,-1);
INSERT INTO `disabled_clothing` VALUES (140,'m','top',292,-1);
INSERT INTO `disabled_clothing` VALUES (141,'m','top',293,-1);
INSERT INTO `disabled_clothing` VALUES (142,'m','top',294,-1);
INSERT INTO `disabled_clothing` VALUES (143,'m','top',295,-1);
INSERT INTO `disabled_clothing` VALUES (144,'m','top',303,-1);
INSERT INTO `disabled_clothing` VALUES (145,'m','top',304,-1);
INSERT INTO `disabled_clothing` VALUES (146,'m','top',309,-1);
INSERT INTO `disabled_clothing` VALUES (147,'m','top',310,-1);
INSERT INTO `disabled_clothing` VALUES (148,'m','top',311,-1);
INSERT INTO `disabled_clothing` VALUES (149,'m','top',312,-1);
INSERT INTO `disabled_clothing` VALUES (150,'m','top',314,-1);
INSERT INTO `disabled_clothing` VALUES (151,'m','top',315,-1);
INSERT INTO `disabled_clothing` VALUES (152,'m','top',319,-1);
INSERT INTO `disabled_clothing` VALUES (153,'m','top',320,-1);
INSERT INTO `disabled_clothing` VALUES (154,'m','top',327,-1);
INSERT INTO `disabled_clothing` VALUES (155,'m','top',328,-1);
INSERT INTO `disabled_clothing` VALUES (156,'m','top',333,-1);
INSERT INTO `disabled_clothing` VALUES (157,'m','top',336,-1);
INSERT INTO `disabled_clothing` VALUES (158,'m','top',337,-1);
INSERT INTO `disabled_clothing` VALUES (159,'m','top',338,-1);
INSERT INTO `disabled_clothing` VALUES (160,'m','top',339,-1);
INSERT INTO `disabled_clothing` VALUES (161,'m','top',340,-1);
INSERT INTO `disabled_clothing` VALUES (162,'m','top',344,-1);
INSERT INTO `disabled_clothing` VALUES (163,'m','top',353,-1);
INSERT INTO `disabled_clothing` VALUES (164,'m','top',360,-1);
INSERT INTO `disabled_clothing` VALUES (165,'m','top',362,-1);
INSERT INTO `disabled_clothing` VALUES (166,'m','top',363,-1);
INSERT INTO `disabled_clothing` VALUES (167,'m','top',364,-1);
INSERT INTO `disabled_clothing` VALUES (168,'m','top',372,-1);
INSERT INTO `disabled_clothing` VALUES (169,'m','top',376,-1);
INSERT INTO `disabled_clothing` VALUES (170,'m','top',380,-1);
INSERT INTO `disabled_clothing` VALUES (171,'m','top',381,-1);
INSERT INTO `disabled_clothing` VALUES (172,'m','top',382,-1);
INSERT INTO `disabled_clothing` VALUES (173,'m','top',383,-1);
INSERT INTO `disabled_clothing` VALUES (174,'m','top',387,-1);
INSERT INTO `disabled_clothing` VALUES (175,'m','top',390,-1);
INSERT INTO `disabled_clothing` VALUES (176,'m','top',391,-1);
INSERT INTO `disabled_clothing` VALUES (177,'m','top',393,-1);
INSERT INTO `disabled_clothing` VALUES (178,'m','top',394,-1);
INSERT INTO `disabled_clothing` VALUES (179,'m','top',396,-1);
INSERT INTO `disabled_clothing` VALUES (180,'m','top',397,-1);
INSERT INTO `disabled_clothing` VALUES (181,'m','top',398,-1);
INSERT INTO `disabled_clothing` VALUES (182,'m','top',399,-1);
INSERT INTO `disabled_clothing` VALUES (183,'m','top',400,-1);
INSERT INTO `disabled_clothing` VALUES (184,'m','top',403,-1);
INSERT INTO `disabled_clothing` VALUES (185,'m','top',404,-1);
INSERT INTO `disabled_clothing` VALUES (186,'m','top',409,-1);
INSERT INTO `disabled_clothing` VALUES (187,'m','top',412,-1);
INSERT INTO `disabled_clothing` VALUES (188,'m','top',414,-1);
INSERT INTO `disabled_clothing` VALUES (189,'m','top',415,-1);
INSERT INTO `disabled_clothing` VALUES (190,'m','top',416,-1);
INSERT INTO `disabled_clothing` VALUES (191,'m','top',417,-1);
INSERT INTO `disabled_clothing` VALUES (192,'m','top',418,-1);
INSERT INTO `disabled_clothing` VALUES (193,'m','top',419,-1);
INSERT INTO `disabled_clothing` VALUES (194,'m','top',420,-1);
INSERT INTO `disabled_clothing` VALUES (195,'m','top',422,-1);
INSERT INTO `disabled_clothing` VALUES (196,'m','top',424,-1);
INSERT INTO `disabled_clothing` VALUES (197,'m','top',425,-1);
INSERT INTO `disabled_clothing` VALUES (198,'m','top',426,-1);
INSERT INTO `disabled_clothing` VALUES (199,'m','top',427,-1);
INSERT INTO `disabled_clothing` VALUES (200,'m','top',430,-1);
INSERT INTO `disabled_clothing` VALUES (201,'m','top',432,-1);
INSERT INTO `disabled_clothing` VALUES (202,'m','top',433,-1);
INSERT INTO `disabled_clothing` VALUES (203,'m','top',434,-1);
INSERT INTO `disabled_clothing` VALUES (204,'m','top',435,-1);
INSERT INTO `disabled_clothing` VALUES (205,'m','top',436,-1);
INSERT INTO `disabled_clothing` VALUES (206,'m','top',439,-1);
INSERT INTO `disabled_clothing` VALUES (207,'m','top',440,-1);
INSERT INTO `disabled_clothing` VALUES (208,'m','top',442,-1);
INSERT INTO `disabled_clothing` VALUES (209,'m','top',443,-1);
INSERT INTO `disabled_clothing` VALUES (210,'m','top',444,-1);
INSERT INTO `disabled_clothing` VALUES (211,'m','top',445,-1);
INSERT INTO `disabled_clothing` VALUES (212,'m','top',446,-1);
INSERT INTO `disabled_clothing` VALUES (213,'m','top',447,-1);
INSERT INTO `disabled_clothing` VALUES (214,'m','top',448,-1);
INSERT INTO `disabled_clothing` VALUES (215,'m','top',449,-1);
INSERT INTO `disabled_clothing` VALUES (216,'m','top',450,-1);
INSERT INTO `disabled_clothing` VALUES (217,'m','top',451,-1);
INSERT INTO `disabled_clothing` VALUES (218,'m','top',452,-1);
INSERT INTO `disabled_clothing` VALUES (219,'m','top',454,-1);
INSERT INTO `disabled_clothing` VALUES (220,'m','top',456,-1);
INSERT INTO `disabled_clothing` VALUES (221,'m','top',457,-1);
INSERT INTO `disabled_clothing` VALUES (222,'m','top',458,-1);
INSERT INTO `disabled_clothing` VALUES (223,'m','top',459,-1);
INSERT INTO `disabled_clothing` VALUES (224,'m','top',460,-1);
INSERT INTO `disabled_clothing` VALUES (225,'m','top',461,-1);
INSERT INTO `disabled_clothing` VALUES (226,'m','top',462,-1);
INSERT INTO `disabled_clothing` VALUES (227,'m','top',463,-1);
INSERT INTO `disabled_clothing` VALUES (228,'m','top',465,-1);
INSERT INTO `disabled_clothing` VALUES (229,'m','top',466,-1);
INSERT INTO `disabled_clothing` VALUES (230,'m','top',468,-1);
INSERT INTO `disabled_clothing` VALUES (231,'m','top',469,-1);
INSERT INTO `disabled_clothing` VALUES (232,'m','top',470,-1);
INSERT INTO `disabled_clothing` VALUES (233,'m','top',471,-1);
INSERT INTO `disabled_clothing` VALUES (234,'m','top',473,-1);
INSERT INTO `disabled_clothing` VALUES (235,'m','top',475,-1);
INSERT INTO `disabled_clothing` VALUES (236,'m','top',476,-1);
INSERT INTO `disabled_clothing` VALUES (237,'m','top',477,-1);
INSERT INTO `disabled_clothing` VALUES (238,'m','top',478,-1);
INSERT INTO `disabled_clothing` VALUES (239,'m','top',482,-1);
INSERT INTO `disabled_clothing` VALUES (240,'m','top',483,-1);
INSERT INTO `disabled_clothing` VALUES (241,'m','top',484,-1);
INSERT INTO `disabled_clothing` VALUES (242,'m','top',486,-1);
INSERT INTO `disabled_clothing` VALUES (243,'m','top',487,-1);
INSERT INTO `disabled_clothing` VALUES (244,'m','top',488,-1);
INSERT INTO `disabled_clothing` VALUES (245,'m','top',489,-1);
INSERT INTO `disabled_clothing` VALUES (246,'m','top',491,-1);
INSERT INTO `disabled_clothing` VALUES (247,'m','top',492,-1);
INSERT INTO `disabled_clothing` VALUES (248,'m','top',493,-1);
INSERT INTO `disabled_clothing` VALUES (249,'m','top',494,-1);
INSERT INTO `disabled_clothing` VALUES (250,'m','top',495,-1);
INSERT INTO `disabled_clothing` VALUES (251,'m','top',496,-1);
INSERT INTO `disabled_clothing` VALUES (252,'m','top',499,-1);
INSERT INTO `disabled_clothing` VALUES (253,'m','top',500,-1);
INSERT INTO `disabled_clothing` VALUES (254,'m','top',501,-1);
INSERT INTO `disabled_clothing` VALUES (255,'m','top',502,-1);
INSERT INTO `disabled_clothing` VALUES (256,'m','top',503,-1);
INSERT INTO `disabled_clothing` VALUES (257,'m','top',504,-1);
INSERT INTO `disabled_clothing` VALUES (258,'m','top',505,-1);
INSERT INTO `disabled_clothing` VALUES (259,'m','top',506,-1);
INSERT INTO `disabled_clothing` VALUES (260,'m','top',508,-1);
INSERT INTO `disabled_clothing` VALUES (261,'m','top',509,-1);
INSERT INTO `disabled_clothing` VALUES (262,'m','top',510,-1);
INSERT INTO `disabled_clothing` VALUES (263,'m','top',511,-1);
INSERT INTO `disabled_clothing` VALUES (264,'m','top',512,-1);
INSERT INTO `disabled_clothing` VALUES (265,'m','top',513,-1);
INSERT INTO `disabled_clothing` VALUES (266,'m','top',514,-1);
INSERT INTO `disabled_clothing` VALUES (267,'m','top',515,-1);
INSERT INTO `disabled_clothing` VALUES (268,'m','top',516,-1);
INSERT INTO `disabled_clothing` VALUES (269,'m','top',517,-1);
INSERT INTO `disabled_clothing` VALUES (270,'m','top',518,-1);
INSERT INTO `disabled_clothing` VALUES (271,'m','top',519,-1);
INSERT INTO `disabled_clothing` VALUES (272,'m','top',520,-1);
INSERT INTO `disabled_clothing` VALUES (273,'m','top',523,-1);
INSERT INTO `disabled_clothing` VALUES (274,'m','top',524,-1);
INSERT INTO `disabled_clothing` VALUES (275,'m','top',525,-1);
INSERT INTO `disabled_clothing` VALUES (276,'m','top',526,-1);
INSERT INTO `disabled_clothing` VALUES (277,'m','top',528,-1);
INSERT INTO `disabled_clothing` VALUES (278,'m','top',529,-1);
INSERT INTO `disabled_clothing` VALUES (279,'m','top',530,-1);
INSERT INTO `disabled_clothing` VALUES (280,'m','top',531,-1);
INSERT INTO `disabled_clothing` VALUES (281,'m','top',532,-1);
INSERT INTO `disabled_clothing` VALUES (282,'m','top',533,-1);
INSERT INTO `disabled_clothing` VALUES (283,'m','top',534,-1);
INSERT INTO `disabled_clothing` VALUES (284,'m','top',535,-1);
INSERT INTO `disabled_clothing` VALUES (285,'m','top',536,-1);
INSERT INTO `disabled_clothing` VALUES (286,'m','top',539,-1);
INSERT INTO `disabled_clothing` VALUES (381,'m','top',540,-1);
INSERT INTO `disabled_clothing` VALUES (288,'m','top',541,-1);
INSERT INTO `disabled_clothing` VALUES (383,'m','top',542,-1);
INSERT INTO `disabled_clothing` VALUES (382,'m','top',542,1);
INSERT INTO `disabled_clothing` VALUES (290,'m','top',543,-1);
INSERT INTO `disabled_clothing` VALUES (291,'m','top',544,-1);
INSERT INTO `disabled_clothing` VALUES (292,'m','top',545,-1);
INSERT INTO `disabled_clothing` VALUES (293,'m','top',546,-1);
INSERT INTO `disabled_clothing` VALUES (294,'m','top',547,-1);
INSERT INTO `disabled_clothing` VALUES (380,'m','top',548,-1);
INSERT INTO `disabled_clothing` VALUES (295,'m','top',552,-1);
INSERT INTO `disabled_clothing` VALUES (296,'m','top',553,-1);
INSERT INTO `disabled_clothing` VALUES (297,'m','top',554,-1);
INSERT INTO `disabled_clothing` VALUES (298,'m','top',555,-1);
INSERT INTO `disabled_clothing` VALUES (299,'m','top',556,-1);
INSERT INTO `disabled_clothing` VALUES (300,'m','top',557,-1);
INSERT INTO `disabled_clothing` VALUES (301,'m','top',558,-1);
INSERT INTO `disabled_clothing` VALUES (302,'m','top',559,-1);
INSERT INTO `disabled_clothing` VALUES (303,'m','top',560,-1);
INSERT INTO `disabled_clothing` VALUES (304,'m','top',561,-1);
INSERT INTO `disabled_clothing` VALUES (305,'m','top',562,-1);
INSERT INTO `disabled_clothing` VALUES (306,'m','top',563,-1);
INSERT INTO `disabled_clothing` VALUES (307,'m','top',564,-1);
INSERT INTO `disabled_clothing` VALUES (308,'m','top',565,-1);
INSERT INTO `disabled_clothing` VALUES (309,'m','top',566,-1);
INSERT INTO `disabled_clothing` VALUES (310,'m','top',567,-1);
INSERT INTO `disabled_clothing` VALUES (311,'m','top',568,-1);
INSERT INTO `disabled_clothing` VALUES (312,'m','top',570,-1);
INSERT INTO `disabled_clothing` VALUES (313,'m','top',573,-1);
INSERT INTO `disabled_clothing` VALUES (314,'m','top',574,-1);
INSERT INTO `disabled_clothing` VALUES (315,'m','top',575,-1);
INSERT INTO `disabled_clothing` VALUES (316,'m','top',577,-1);
INSERT INTO `disabled_clothing` VALUES (317,'m','top',579,-1);
INSERT INTO `disabled_clothing` VALUES (318,'m','top',580,-1);
INSERT INTO `disabled_clothing` VALUES (319,'m','top',582,-1);
INSERT INTO `disabled_clothing` VALUES (320,'m','top',583,-1);
INSERT INTO `disabled_clothing` VALUES (321,'m','top',584,-1);
INSERT INTO `disabled_clothing` VALUES (322,'m','top',585,-1);
INSERT INTO `disabled_clothing` VALUES (379,'m','top',587,-1);
INSERT INTO `disabled_clothing` VALUES (324,'m','top',588,-1);
INSERT INTO `disabled_clothing` VALUES (325,'m','top',589,-1);
INSERT INTO `disabled_clothing` VALUES (326,'m','top',590,-1);
INSERT INTO `disabled_clothing` VALUES (327,'m','top',591,-1);
INSERT INTO `disabled_clothing` VALUES (328,'m','top',592,-1);
INSERT INTO `disabled_clothing` VALUES (329,'m','top',593,-1);
INSERT INTO `disabled_clothing` VALUES (330,'m','top',594,-1);
INSERT INTO `disabled_clothing` VALUES (331,'m','top',595,-1);
INSERT INTO `disabled_clothing` VALUES (332,'m','top',596,-1);
INSERT INTO `disabled_clothing` VALUES (333,'m','top',597,-1);
INSERT INTO `disabled_clothing` VALUES (378,'m','top',600,-1);
INSERT INTO `disabled_clothing` VALUES (334,'m','top',601,-1);
INSERT INTO `disabled_clothing` VALUES (335,'m','top',602,-1);
INSERT INTO `disabled_clothing` VALUES (336,'m','top',603,-1);
INSERT INTO `disabled_clothing` VALUES (337,'m','top',604,-1);
INSERT INTO `disabled_clothing` VALUES (338,'m','top',606,-1);
INSERT INTO `disabled_clothing` VALUES (339,'m','top',607,-1);
INSERT INTO `disabled_clothing` VALUES (340,'m','top',608,-1);
INSERT INTO `disabled_clothing` VALUES (341,'m','top',609,-1);
INSERT INTO `disabled_clothing` VALUES (342,'m','top',610,-1);
INSERT INTO `disabled_clothing` VALUES (343,'m','top',615,-1);
INSERT INTO `disabled_clothing` VALUES (344,'m','top',616,-1);
INSERT INTO `disabled_clothing` VALUES (345,'m','top',617,-1);
INSERT INTO `disabled_clothing` VALUES (346,'m','top',618,-1);
INSERT INTO `disabled_clothing` VALUES (347,'m','top',619,-1);
INSERT INTO `disabled_clothing` VALUES (377,'m','top',620,-1);
INSERT INTO `disabled_clothing` VALUES (348,'m','top',621,-1);
INSERT INTO `disabled_clothing` VALUES (349,'m','top',622,-1);
INSERT INTO `disabled_clothing` VALUES (350,'m','top',623,-1);
INSERT INTO `disabled_clothing` VALUES (351,'m','top',624,-1);
INSERT INTO `disabled_clothing` VALUES (352,'m','top',625,-1);
INSERT INTO `disabled_clothing` VALUES (353,'m','top',626,-1);
INSERT INTO `disabled_clothing` VALUES (354,'m','top',627,-1);
INSERT INTO `disabled_clothing` VALUES (355,'m','top',628,-1);
INSERT INTO `disabled_clothing` VALUES (384,'m','undershirt',16,-1);
INSERT INTO `disabled_clothing` VALUES (385,'m','undershirt',17,-1);
INSERT INTO `disabled_clothing` VALUES (386,'m','undershirt',19,-1);
INSERT INTO `disabled_clothing` VALUES (387,'m','undershirt',20,-1);
INSERT INTO `disabled_clothing` VALUES (388,'m','undershirt',21,-1);
INSERT INTO `disabled_clothing` VALUES (389,'m','undershirt',22,-1);
INSERT INTO `disabled_clothing` VALUES (390,'m','undershirt',23,-1);
INSERT INTO `disabled_clothing` VALUES (391,'m','undershirt',24,-1);
INSERT INTO `disabled_clothing` VALUES (392,'m','undershirt',25,-1);
INSERT INTO `disabled_clothing` VALUES (393,'m','undershirt',26,-1);
INSERT INTO `disabled_clothing` VALUES (394,'m','undershirt',27,-1);
INSERT INTO `disabled_clothing` VALUES (395,'m','undershirt',28,-1);
INSERT INTO `disabled_clothing` VALUES (396,'m','undershirt',29,-1);
INSERT INTO `disabled_clothing` VALUES (397,'m','undershirt',30,-1);
INSERT INTO `disabled_clothing` VALUES (398,'m','undershirt',31,-1);
INSERT INTO `disabled_clothing` VALUES (399,'m','undershirt',32,-1);
INSERT INTO `disabled_clothing` VALUES (400,'m','undershirt',33,-1);
INSERT INTO `disabled_clothing` VALUES (401,'m','undershirt',34,-1);
INSERT INTO `disabled_clothing` VALUES (402,'m','undershirt',35,-1);
INSERT INTO `disabled_clothing` VALUES (403,'m','undershirt',36,-1);
INSERT INTO `disabled_clothing` VALUES (404,'m','undershirt',37,-1);
INSERT INTO `disabled_clothing` VALUES (405,'m','undershirt',38,-1);
INSERT INTO `disabled_clothing` VALUES (406,'m','undershirt',39,-1);
INSERT INTO `disabled_clothing` VALUES (407,'m','undershirt',40,-1);
INSERT INTO `disabled_clothing` VALUES (408,'m','undershirt',41,-1);
INSERT INTO `disabled_clothing` VALUES (409,'m','undershirt',42,-1);
INSERT INTO `disabled_clothing` VALUES (410,'m','undershirt',43,-1);
INSERT INTO `disabled_clothing` VALUES (411,'m','undershirt',44,-1);
INSERT INTO `disabled_clothing` VALUES (412,'m','undershirt',45,-1);
INSERT INTO `disabled_clothing` VALUES (413,'m','undershirt',46,-1);
INSERT INTO `disabled_clothing` VALUES (414,'m','undershirt',47,-1);
INSERT INTO `disabled_clothing` VALUES (415,'m','undershirt',48,-1);
INSERT INTO `disabled_clothing` VALUES (416,'m','undershirt',49,-1);
INSERT INTO `disabled_clothing` VALUES (417,'m','undershirt',50,-1);
INSERT INTO `disabled_clothing` VALUES (418,'m','undershirt',51,-1);
INSERT INTO `disabled_clothing` VALUES (419,'m','undershirt',52,-1);
INSERT INTO `disabled_clothing` VALUES (420,'m','undershirt',53,-1);
INSERT INTO `disabled_clothing` VALUES (421,'m','undershirt',54,-1);
INSERT INTO `disabled_clothing` VALUES (424,'m','undershirt',55,-1);
INSERT INTO `disabled_clothing` VALUES (423,'m','undershirt',56,-1);
INSERT INTO `disabled_clothing` VALUES (425,'m','undershirt',57,-1);
INSERT INTO `disabled_clothing` VALUES (426,'m','undershirt',58,-1);
INSERT INTO `disabled_clothing` VALUES (427,'m','undershirt',59,-1);
INSERT INTO `disabled_clothing` VALUES (428,'m','undershirt',60,-1);
INSERT INTO `disabled_clothing` VALUES (429,'m','undershirt',61,-1);
INSERT INTO `disabled_clothing` VALUES (430,'m','undershirt',62,-1);
INSERT INTO `disabled_clothing` VALUES (431,'m','undershirt',63,-1);
INSERT INTO `disabled_clothing` VALUES (432,'m','undershirt',64,-1);
INSERT INTO `disabled_clothing` VALUES (433,'m','undershirt',65,-1);
INSERT INTO `disabled_clothing` VALUES (434,'m','undershirt',66,-1);
INSERT INTO `disabled_clothing` VALUES (435,'m','undershirt',67,-1);
INSERT INTO `disabled_clothing` VALUES (436,'m','undershirt',68,-1);
INSERT INTO `disabled_clothing` VALUES (437,'m','undershirt',69,-1);
INSERT INTO `disabled_clothing` VALUES (438,'m','undershirt',70,-1);
INSERT INTO `disabled_clothing` VALUES (439,'m','undershirt',71,-1);
INSERT INTO `disabled_clothing` VALUES (440,'m','undershirt',72,-1);
INSERT INTO `disabled_clothing` VALUES (441,'m','undershirt',73,-1);
INSERT INTO `disabled_clothing` VALUES (442,'m','undershirt',74,-1);
INSERT INTO `disabled_clothing` VALUES (443,'m','undershirt',75,-1);
INSERT INTO `disabled_clothing` VALUES (444,'m','undershirt',76,-1);
INSERT INTO `disabled_clothing` VALUES (445,'m','undershirt',77,-1);
INSERT INTO `disabled_clothing` VALUES (446,'m','undershirt',78,-1);
INSERT INTO `disabled_clothing` VALUES (447,'m','undershirt',79,-1);
INSERT INTO `disabled_clothing` VALUES (448,'m','undershirt',80,-1);
INSERT INTO `disabled_clothing` VALUES (449,'m','undershirt',81,-1);
INSERT INTO `disabled_clothing` VALUES (450,'m','undershirt',82,-1);
INSERT INTO `disabled_clothing` VALUES (451,'m','undershirt',83,-1);
INSERT INTO `disabled_clothing` VALUES (452,'m','undershirt',84,-1);
INSERT INTO `disabled_clothing` VALUES (453,'m','undershirt',85,-1);
INSERT INTO `disabled_clothing` VALUES (454,'m','undershirt',86,-1);
INSERT INTO `disabled_clothing` VALUES (455,'m','undershirt',87,-1);
INSERT INTO `disabled_clothing` VALUES (456,'m','undershirt',88,-1);
INSERT INTO `disabled_clothing` VALUES (457,'m','undershirt',89,-1);
INSERT INTO `disabled_clothing` VALUES (458,'m','undershirt',90,-1);
INSERT INTO `disabled_clothing` VALUES (459,'m','undershirt',91,-1);
INSERT INTO `disabled_clothing` VALUES (460,'m','undershirt',92,-1);
INSERT INTO `disabled_clothing` VALUES (461,'m','undershirt',93,-1);
INSERT INTO `disabled_clothing` VALUES (462,'m','undershirt',94,-1);
INSERT INTO `disabled_clothing` VALUES (463,'m','undershirt',95,-1);
INSERT INTO `disabled_clothing` VALUES (464,'m','undershirt',96,-1);
INSERT INTO `disabled_clothing` VALUES (465,'m','undershirt',97,-1);
INSERT INTO `disabled_clothing` VALUES (466,'m','undershirt',98,-1);
INSERT INTO `disabled_clothing` VALUES (467,'m','undershirt',99,-1);
INSERT INTO `disabled_clothing` VALUES (468,'m','undershirt',100,-1);
INSERT INTO `disabled_clothing` VALUES (469,'m','undershirt',101,-1);
INSERT INTO `disabled_clothing` VALUES (470,'m','undershirt',102,-1);
INSERT INTO `disabled_clothing` VALUES (471,'m','undershirt',103,-1);
INSERT INTO `disabled_clothing` VALUES (472,'m','undershirt',104,-1);
INSERT INTO `disabled_clothing` VALUES (473,'m','undershirt',105,-1);
INSERT INTO `disabled_clothing` VALUES (474,'m','undershirt',106,-1);
INSERT INTO `disabled_clothing` VALUES (475,'m','undershirt',107,-1);
INSERT INTO `disabled_clothing` VALUES (476,'m','undershirt',108,-1);
INSERT INTO `disabled_clothing` VALUES (477,'m','undershirt',109,-1);
INSERT INTO `disabled_clothing` VALUES (478,'m','undershirt',110,-1);
INSERT INTO `disabled_clothing` VALUES (479,'m','undershirt',111,-1);
INSERT INTO `disabled_clothing` VALUES (480,'m','undershirt',112,-1);
INSERT INTO `disabled_clothing` VALUES (481,'m','undershirt',113,-1);
INSERT INTO `disabled_clothing` VALUES (482,'m','undershirt',114,-1);
INSERT INTO `disabled_clothing` VALUES (483,'m','undershirt',115,-1);
INSERT INTO `disabled_clothing` VALUES (484,'m','undershirt',116,-1);
INSERT INTO `disabled_clothing` VALUES (485,'m','undershirt',117,-1);
INSERT INTO `disabled_clothing` VALUES (486,'m','undershirt',118,-1);
INSERT INTO `disabled_clothing` VALUES (487,'m','undershirt',119,-1);
INSERT INTO `disabled_clothing` VALUES (488,'m','undershirt',120,-1);
INSERT INTO `disabled_clothing` VALUES (489,'m','undershirt',121,-1);
INSERT INTO `disabled_clothing` VALUES (490,'m','undershirt',122,-1);
INSERT INTO `disabled_clothing` VALUES (491,'m','undershirt',123,-1);
INSERT INTO `disabled_clothing` VALUES (492,'m','undershirt',124,-1);
INSERT INTO `disabled_clothing` VALUES (493,'m','undershirt',125,-1);
INSERT INTO `disabled_clothing` VALUES (494,'m','undershirt',126,-1);
INSERT INTO `disabled_clothing` VALUES (495,'m','undershirt',127,-1);
INSERT INTO `disabled_clothing` VALUES (496,'m','undershirt',128,-1);
INSERT INTO `disabled_clothing` VALUES (497,'m','undershirt',129,-1);
INSERT INTO `disabled_clothing` VALUES (498,'m','undershirt',130,-1);
INSERT INTO `disabled_clothing` VALUES (499,'m','undershirt',131,-1);
INSERT INTO `disabled_clothing` VALUES (500,'m','undershirt',132,-1);
INSERT INTO `disabled_clothing` VALUES (501,'m','undershirt',133,-1);
INSERT INTO `disabled_clothing` VALUES (502,'m','undershirt',134,-1);
INSERT INTO `disabled_clothing` VALUES (503,'m','undershirt',135,-1);
INSERT INTO `disabled_clothing` VALUES (504,'m','undershirt',136,-1);
INSERT INTO `disabled_clothing` VALUES (505,'m','undershirt',137,-1);
INSERT INTO `disabled_clothing` VALUES (506,'m','undershirt',138,-1);
INSERT INTO `disabled_clothing` VALUES (507,'m','undershirt',139,-1);
INSERT INTO `disabled_clothing` VALUES (508,'m','undershirt',140,-1);
INSERT INTO `disabled_clothing` VALUES (509,'m','undershirt',141,-1);
INSERT INTO `disabled_clothing` VALUES (510,'m','undershirt',142,-1);
INSERT INTO `disabled_clothing` VALUES (511,'m','undershirt',143,-1);
INSERT INTO `disabled_clothing` VALUES (512,'m','undershirt',144,-1);
INSERT INTO `disabled_clothing` VALUES (513,'m','undershirt',145,-1);
INSERT INTO `disabled_clothing` VALUES (514,'m','undershirt',146,-1);
INSERT INTO `disabled_clothing` VALUES (515,'m','undershirt',147,-1);
INSERT INTO `disabled_clothing` VALUES (516,'m','undershirt',148,-1);
INSERT INTO `disabled_clothing` VALUES (517,'m','undershirt',149,-1);
INSERT INTO `disabled_clothing` VALUES (518,'m','undershirt',150,-1);
INSERT INTO `disabled_clothing` VALUES (519,'m','undershirt',151,-1);
INSERT INTO `disabled_clothing` VALUES (520,'m','undershirt',152,-1);
INSERT INTO `disabled_clothing` VALUES (521,'m','undershirt',153,-1);
INSERT INTO `disabled_clothing` VALUES (522,'m','undershirt',154,-1);
INSERT INTO `disabled_clothing` VALUES (523,'m','undershirt',155,-1);
INSERT INTO `disabled_clothing` VALUES (524,'m','undershirt',156,-1);
INSERT INTO `disabled_clothing` VALUES (525,'m','undershirt',157,-1);
INSERT INTO `disabled_clothing` VALUES (526,'m','undershirt',158,-1);
INSERT INTO `disabled_clothing` VALUES (527,'m','undershirt',159,-1);
INSERT INTO `disabled_clothing` VALUES (528,'m','undershirt',160,-1);
INSERT INTO `disabled_clothing` VALUES (529,'m','undershirt',161,-1);
INSERT INTO `disabled_clothing` VALUES (530,'m','undershirt',162,-1);
INSERT INTO `disabled_clothing` VALUES (531,'m','undershirt',163,-1);
INSERT INTO `disabled_clothing` VALUES (532,'m','undershirt',164,-1);
INSERT INTO `disabled_clothing` VALUES (533,'m','undershirt',165,-1);
INSERT INTO `disabled_clothing` VALUES (534,'m','undershirt',166,-1);
INSERT INTO `disabled_clothing` VALUES (535,'m','undershirt',167,-1);
INSERT INTO `disabled_clothing` VALUES (536,'m','undershirt',168,-1);
INSERT INTO `disabled_clothing` VALUES (537,'m','undershirt',169,-1);
INSERT INTO `disabled_clothing` VALUES (538,'m','undershirt',172,-1);
INSERT INTO `disabled_clothing` VALUES (539,'m','undershirt',173,-1);
INSERT INTO `disabled_clothing` VALUES (540,'m','undershirt',174,-1);
INSERT INTO `disabled_clothing` VALUES (541,'m','undershirt',175,-1);
INSERT INTO `disabled_clothing` VALUES (542,'m','undershirt',176,-1);
INSERT INTO `disabled_clothing` VALUES (543,'m','undershirt',177,-1);
INSERT INTO `disabled_clothing` VALUES (544,'m','undershirt',178,-1);
INSERT INTO `disabled_clothing` VALUES (545,'m','undershirt',179,-1);
INSERT INTO `disabled_clothing` VALUES (546,'m','undershirt',180,-1);
INSERT INTO `disabled_clothing` VALUES (547,'m','undershirt',181,-1);
INSERT INTO `disabled_clothing` VALUES (548,'m','undershirt',182,-1);
INSERT INTO `disabled_clothing` VALUES (549,'m','undershirt',183,-1);
INSERT INTO `disabled_clothing` VALUES (550,'m','undershirt',184,-1);
INSERT INTO `disabled_clothing` VALUES (551,'m','undershirt',185,-1);
INSERT INTO `disabled_clothing` VALUES (552,'m','undershirt',186,-1);
INSERT INTO `disabled_clothing` VALUES (553,'m','undershirt',187,-1);
INSERT INTO `disabled_clothing` VALUES (554,'m','undershirt',188,-1);
INSERT INTO `disabled_clothing` VALUES (555,'m','undershirt',189,-1);
INSERT INTO `disabled_clothing` VALUES (556,'m','undershirt',190,-1);
INSERT INTO `disabled_clothing` VALUES (557,'m','undershirt',191,-1);
INSERT INTO `disabled_clothing` VALUES (558,'m','undershirt',192,-1);
INSERT INTO `disabled_clothing` VALUES (559,'m','undershirt',193,-1);
INSERT INTO `disabled_clothing` VALUES (560,'m','undershirt',194,-1);
INSERT INTO `disabled_clothing` VALUES (561,'m','undershirt',195,-1);
INSERT INTO `disabled_clothing` VALUES (562,'m','undershirt',196,-1);
INSERT INTO `disabled_clothing` VALUES (563,'m','undershirt',197,-1);
INSERT INTO `disabled_clothing` VALUES (564,'m','undershirt',198,-1);
INSERT INTO `disabled_clothing` VALUES (565,'m','undershirt',199,-1);
INSERT INTO `disabled_clothing` VALUES (566,'m','undershirt',200,-1);
INSERT INTO `disabled_clothing` VALUES (567,'m','undershirt',201,-1);
INSERT INTO `disabled_clothing` VALUES (568,'m','undershirt',202,-1);
INSERT INTO `disabled_clothing` VALUES (569,'m','undershirt',203,-1);
INSERT INTO `disabled_clothing` VALUES (570,'m','undershirt',204,-1);
INSERT INTO `disabled_clothing` VALUES (571,'m','undershirt',205,-1);
INSERT INTO `disabled_clothing` VALUES (572,'m','undershirt',206,-1);
INSERT INTO `disabled_clothing` VALUES (573,'m','undershirt',207,-1);
INSERT INTO `disabled_clothing` VALUES (574,'m','undershirt',208,-1);
INSERT INTO `disabled_clothing` VALUES (575,'m','undershirt',209,-1);
INSERT INTO `disabled_clothing` VALUES (576,'m','undershirt',210,-1);
INSERT INTO `disabled_clothing` VALUES (577,'m','undershirt',211,-1);
INSERT INTO `disabled_clothing` VALUES (578,'m','undershirt',212,-1);
INSERT INTO `disabled_clothing` VALUES (579,'m','undershirt',213,-1);
INSERT INTO `disabled_clothing` VALUES (580,'m','undershirt',214,-1);
INSERT INTO `disabled_clothing` VALUES (581,'m','undershirt',215,-1);
INSERT INTO `disabled_clothing` VALUES (582,'m','undershirt',216,-1);
INSERT INTO `disabled_clothing` VALUES (583,'m','undershirt',217,-1);
INSERT INTO `disabled_clothing` VALUES (584,'m','undershirt',218,-1);
INSERT INTO `disabled_clothing` VALUES (585,'m','undershirt',219,-1);
INSERT INTO `disabled_clothing` VALUES (586,'m','undershirt',220,-1);
INSERT INTO `disabled_clothing` VALUES (587,'m','undershirt',221,-1);
INSERT INTO `disabled_clothing` VALUES (1235,'m','watch',1,1);
INSERT INTO `disabled_clothing` VALUES (1236,'m','watch',1,2);
INSERT INTO `disabled_clothing` VALUES (1238,'m','watch',1,3);
INSERT INTO `disabled_clothing` VALUES (1237,'m','watch',1,4);
INSERT INTO `disabled_clothing` VALUES (1239,'m','watch',2,-1);
/*!40000 ALTER TABLE `disabled_clothing` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `gangs`
--

DROP TABLE IF EXISTS `gangs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `gangs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(48) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tag` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `color` varchar(9) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#c0392b',
  `leader_character_id` bigint DEFAULT NULL,
  `members` json NOT NULL,
  `ranks` json NOT NULL,
  `base` json DEFAULT NULL,
  `treasury` bigint NOT NULL DEFAULT '0',
  `stash` json NOT NULL,
  `crafting` json DEFAULT NULL,
  `created_at` bigint DEFAULT NULL,
  `static_key` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `interior` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_e32b69a18afd153c6a32a5efe9` (`name`),
  UNIQUE KEY `IDX_c6349470c5548ecdc2441be3ba` (`tag`),
  UNIQUE KEY `IDX_6d29ee7e1bd32f81748f985e70` (`static_key`),
  KEY `IDX_46d588aef50e9cdaa820b8fdf6` (`leader_character_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `gangs`
--

LOCK TABLES `gangs` WRITE;
/*!40000 ALTER TABLE `gangs` DISABLE KEYS */;
INSERT INTO `gangs` VALUES (1,'Ballas','BLS','#7d3cb5',NULL,'[]','[{\"key\": \"recruit\", \"label\": \"ახალბედა\", \"level\": 0, \"permissions\": []}, {\"key\": \"soldier\", \"label\": \"ჯარისკაცი\", \"level\": 1, \"permissions\": [\"stash_use\"]}, {\"key\": \"enforcer\", \"label\": \"მებრძოლი\", \"level\": 2, \"permissions\": [\"stash_use\", \"craft\", \"vehicle\"]}, {\"key\": \"officer\", \"label\": \"ოფიცერი\", \"level\": 3, \"permissions\": [\"stash_use\", \"craft\", \"invite\", \"kick\", \"treasury\", \"buy_materials\", \"vehicle\"]}, {\"key\": \"leader\", \"label\": \"ლიდერი\", \"level\": 4, \"permissions\": [\"*\"]}]','{\"h\": -131.3, \"x\": 85.535, \"y\": -1959.401, \"z\": 21.122, \"dim\": 0}',952000,'{\"armor\": 2, \"kevlar\": 94, \"gunpowder\": 100, \"metal_scrap\": 96, \"weapon_parts\": 99}',NULL,NULL,'greens','{\"h\": -131.3, \"x\": 85.535, \"y\": -1959.401, \"z\": 21.122}');
/*!40000 ALTER TABLE `gangs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `houses`
--

DROP TABLE IF EXISTS `houses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `houses` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `price` bigint NOT NULL DEFAULT '0',
  `interior` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `building` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `door` json DEFAULT NULL,
  `door_model` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `chest_point` json DEFAULT NULL,
  `garage` json DEFAULT NULL,
  `spawn` json DEFAULT NULL,
  `owner_character_id` bigint DEFAULT NULL,
  `owner_name` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `locked` tinyint NOT NULL DEFAULT '0',
  `chest` json DEFAULT NULL,
  `spawn_home` tinyint NOT NULL DEFAULT '0',
  `created_at` bigint DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_2cee48d9be0c9a268333715a99` (`owner_character_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `houses`
--

LOCK TABLES `houses` WRITE;
/*!40000 ALTER TABLE `houses` DISABLE KEYS */;
/*!40000 ALTER TABLE `houses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_items`
--

DROP TABLE IF EXISTS `inventory_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `character_id` bigint NOT NULL,
  `slot` int NOT NULL,
  `item_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `qty` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_fa0ec26a94ebc6c3c7140ae576` (`character_id`,`slot`)
) ENGINE=InnoDB AUTO_INCREMENT=660 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_items`
--

LOCK TABLES `inventory_items` WRITE;
/*!40000 ALTER TABLE `inventory_items` DISABLE KEYS */;
INSERT INTO `inventory_items` VALUES (567,1,0,'idcard_1',1);
INSERT INTO `inventory_items` VALUES (568,1,1,'ammo_pistol',10);
INSERT INTO `inventory_items` VALUES (569,1,26,'knife',1);
INSERT INTO `inventory_items` VALUES (570,1,27,'pistol',1);
INSERT INTO `inventory_items` VALUES (657,2,0,'carbinerifle',1);
INSERT INTO `inventory_items` VALUES (658,2,1,'medkit',2);
INSERT INTO `inventory_items` VALUES (659,2,2,'weapon_parts',1);
/*!40000 ALTER TABLE `inventory_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `items`
--

DROP TABLE IF EXISTS `items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `owner_character_id` bigint NOT NULL,
  `item_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `qty` int NOT NULL DEFAULT '1',
  `status` varchar(24) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'inventory',
  `slot` int DEFAULT NULL,
  `pos_x` double DEFAULT NULL,
  `pos_y` double DEFAULT NULL,
  `pos_z` double DEFAULT NULL,
  `dim` int DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `dropped_at` datetime DEFAULT NULL,
  `origin` varchar(24) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_34dfca850e1ba0da01c32b3c0c` (`owner_character_id`),
  KEY `IDX_36275759f2cbc3b5ca32f39341` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `items`
--

LOCK TABLES `items` WRITE;
/*!40000 ALTER TABLE `items` DISABLE KEYS */;
/*!40000 ALTER TABLE `items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `parking_spots`
--

DROP TABLE IF EXISTS `parking_spots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `parking_spots` (
  `spot_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner_character_id` bigint DEFAULT NULL,
  `owner_name` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expires_at` bigint DEFAULT NULL,
  `cars` json DEFAULT NULL,
  `slots` int NOT NULL DEFAULT '1',
  PRIMARY KEY (`spot_id`),
  KEY `IDX_d8276e4ade679fe9fd44fd6c9e` (`owner_character_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `parking_spots`
--

LOCK TABLES `parking_spots` WRITE;
/*!40000 ALTER TABLE `parking_spots` DISABLE KEYS */;
/*!40000 ALTER TABLE `parking_spots` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `resident_number` varchar(11) COLLATE utf8mb4_unicode_ci NOT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_email_validated` tinyint DEFAULT NULL,
  `phone_number` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_phone_validated` tinyint DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `social_club_name` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_type` enum('admin','default','support') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'default',
  `gender` enum('m','f') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_flagged` tinyint NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_97672ac88f789774dd47f7c8be` (`email`),
  UNIQUE KEY `IDX_30305efdfbde58726b9997743f` (`resident_number`),
  UNIQUE KEY `IDX_3abe145b7401372f03cff07a72` (`social_club_name`),
  UNIQUE KEY `IDX_17d1817f241f10a3dbafb169fd` (`phone_number`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'sephsgame@gmail.com','$2b$12$sawSuawGeNp2lglfFnM10ed6.RYCUfzSBCrHMxzBeNVfv5oMmdJC6','20001063776','212.58.103.213',NULL,'+995551252549',NULL,'2026-10-03 02:20:38.504563','2026-10-03 02:23:23.000000','SephiGR','default','m',0);
INSERT INTO `users` VALUES (2,'torikabot@gmail.com','$2b$12$5Sxf0B9KPniaKh74tEV.e.vCZb5c9zse.fbF0Be03m9uO7Pv80JA.','01008055957','127.0.0.1',NULL,'+995551999015',NULL,'2026-10-03 02:22:08.347404','2026-10-03 02:22:19.000000','torika2','default','m',0);
INSERT INTO `users` VALUES (3,'probe_1791135262@test.ge','$2b$12$CC8U2CHrrbtqgpb/xIizKeX.2bLiyUopV37q8pT3lV/twhGvIDxde','99999999999',NULL,NULL,NULL,NULL,'2026-10-04 21:34:22.291125','2026-10-04 21:34:22.291125','probe_other','default',NULL,0);
INSERT INTO `users` VALUES (4,'dupe_1791135285@test.ge','$2b$12$aPyXRMrI41dWgTtjBtAmYurSbcOxelC1tS3TLYLuItqthPTWEozqK','12345678901',NULL,NULL,NULL,NULL,'2026-10-04 21:34:45.861901','2026-10-04 21:34:45.861901','dupe_sc_1791135285','default',NULL,0);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vehicles`
--

DROP TABLE IF EXISTS `vehicles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vehicles` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `character_id` bigint NOT NULL,
  `model` bigint NOT NULL,
  `model_name` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `x` double NOT NULL DEFAULT '0',
  `y` double NOT NULL DEFAULT '0',
  `z` double NOT NULL DEFAULT '0',
  `heading` double NOT NULL DEFAULT '0',
  `dim` int NOT NULL DEFAULT '0',
  `plate` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fuel` float NOT NULL DEFAULT '100',
  `km` double NOT NULL DEFAULT '0',
  `octane` json DEFAULT NULL,
  `tuning` json DEFAULT NULL,
  `visual` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_80a3fc305f8efefebaab4f8ca5` (`character_id`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehicles`
--

LOCK TABLES `vehicles` WRITE;
/*!40000 ALTER TABLE `vehicles` DISABLE KEYS */;
INSERT INTO `vehicles` VALUES (1,2,2106384032,'bmwm4',-70.85906982421875,-1114.9012451171875,24.969810485839844,161.4854736328125,0,NULL,87,1,NULL,NULL,NULL);
INSERT INTO `vehicles` VALUES (2,2,2647072808,'audirs7sport',421.7447814941406,-1293.0352783203125,29.914297103881836,134.78770446777344,0,NULL,99,0,NULL,NULL,NULL);
INSERT INTO `vehicles` VALUES (3,2,62147598,'lx570',-71.59241485595703,-1089.7493896484375,26.431804656982422,-18.058618545532227,0,NULL,99,1,NULL,NULL,NULL);
INSERT INTO `vehicles` VALUES (4,2,461344408,'d5',424.7828063964844,-1309.513916015625,30.59619140625,142.84860229492188,0,NULL,80,0,NULL,NULL,NULL);
INSERT INTO `vehicles` VALUES (5,1,3116674310,'f44',-69.5683364868164,-1101.8780517578125,25.5650691986084,-116.25704193115234,0,NULL,83,3,NULL,NULL,NULL);
INSERT INTO `vehicles` VALUES (6,1,461344408,'d5',-61.44138717651367,-1113.6341552734375,25.684627532958984,178.34474182128906,0,NULL,64,5,NULL,NULL,NULL);
INSERT INTO `vehicles` VALUES (7,1,981770764,'charger69',-75.1718978881836,-1130.981689453125,24.932994842529297,-84.78813171386719,0,NULL,58,6,NULL,NULL,NULL);
INSERT INTO `vehicles` VALUES (8,1,178278300,'rs6',-257.2090148925781,-211.6995849609375,48.295040130615234,82.66717529296875,0,NULL,52,7,NULL,NULL,NULL);
INSERT INTO `vehicles` VALUES (9,1,4136968109,'cls',-65.58934020996094,-1104.499267578125,25.824951171875,-116.89932250976562,0,NULL,49,8,NULL,NULL,NULL);
INSERT INTO `vehicles` VALUES (10,1,1202425643,'sclass',-62.76786422729492,-1101.978759765625,25.829021453857422,-82.69863891601562,0,NULL,44,9,NULL,NULL,NULL);
INSERT INTO `vehicles` VALUES (11,1,3668517403,'audirs7abt',-189.79237365722656,-1783.950439453125,29.292987823486328,-56.10822677612305,0,NULL,91,6,'{\"eff\": 0.75, \"power\": 1.48, \"rating\": 100, \"speedRate\": 1.48}','{\"brakes\": 3, \"engine\": 5, \"launch\": 5, \"handling\": 5, \"topSpeed\": 5}','{\"mods\": {}, \"colors\": {\"primary\": 6, \"secondary\": 6}, \"windowTint\": 6}');
INSERT INTO `vehicles` VALUES (12,1,1507425340,'m8',-820.1376953125,-1012.9617309570312,12.78858757019043,123.80741882324219,0,NULL,100,0,NULL,NULL,NULL);
INSERT INTO `vehicles` VALUES (13,2,1507425340,'m8',443.0743408203125,-1295.3831787109375,29.562366485595703,179.4962615966797,0,NULL,81,5,'{\"eff\": 0.75, \"power\": 1.48, \"rating\": 100, \"speedRate\": 1.48}','{\"engine\": 5, \"launch\": 5, \"topSpeed\": 5}','{\"mods\": {}, \"colors\": {\"primary\": 111, \"secondary\": 111}}');
INSERT INTO `vehicles` VALUES (14,2,3452544967,'f90',446.54742431640625,-1297.1396484375,29.871912002563477,0.1137283518910408,0,NULL,63,13,'{\"eff\": 0.75, \"power\": 1.48, \"rating\": 100, \"speedRate\": 1.48}','{\"brakes\": 0, \"engine\": 5, \"launch\": 4, \"handling\": 0, \"topSpeed\": 5}','{\"mods\": {}, \"colors\": {\"primary\": 111, \"secondary\": 111}}');
INSERT INTO `vehicles` VALUES (15,1,3668517403,'audirs7abt',718.4688110351562,-1099.9759521484375,21.89562225341797,-168.97335815429688,0,NULL,71,2,NULL,'{\"brakes\": 5, \"engine\": 5, \"launch\": 5, \"handling\": 5, \"topSpeed\": 5}','{\"mods\": {}, \"colors\": {\"wheel\": 111}, \"windowTint\": 6}');
INSERT INTO `vehicles` VALUES (16,1,2106384032,'bmwm4',79.37032318115234,-1052.755126953125,28.524456024169922,161.7746124267578,0,NULL,97,6,'{\"eff\": 0.75, \"power\": 1.48, \"rating\": 100, \"speedRate\": 1.48}',NULL,NULL);
INSERT INTO `vehicles` VALUES (17,2,2685874587,'z28',-50.4154167175293,-1076.429931640625,26.250150680541992,75.58201599121094,0,NULL,51,10,'{\"eff\": 0.7499999999999999, \"power\": 1.4799999999999998, \"rating\": 100.0, \"speedRate\": 1.4799999999999998}','{\"brakes\": 2, \"engine\": 5, \"launch\": 5, \"handling\": 5, \"topSpeed\": 5}','{\"mods\": {}, \"colors\": {\"primary\": 111, \"secondary\": 111}}');
INSERT INTO `vehicles` VALUES (18,2,1993609528,'rrst',446.6404113769531,-1297.1595458984375,30.12650489807129,-1.8769854307174683,0,NULL,82,0,NULL,'{\"brakes\": 3, \"engine\": 5, \"launch\": 5, \"handling\": 5, \"topSpeed\": 5}','{\"mods\": {}, \"colors\": {\"primary\": 111, \"secondary\": 111}}');
/*!40000 ALTER TABLE `vehicles` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-09 19:53:06
