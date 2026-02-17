---
name: prompt-architect
description: Transforms simple user ideas into high-quality, structured, and effective prompts. Use this skill when the user provides a brief or vague request and wants a professional prompt to get better results.
---

# Prompt Architect Skill

Bu skill, kullanıcının basit fikirlerini alır ve bunları "Prompt Mühendisliği" prensiplerine (Persona, Bağlam, Görev, Kısıtlamalar) uygun olarak optimize eder.

## When to use this skill

- Kullanıcı "Şunu yapan bir prompt yaz" veya "Şu konuda bir metin istiyorum ama detaylandıramıyorum" dediğinde.
- Bir yapay zeka modelinden (LLM) daha teknik, yaratıcı veya yapılandırılmış bir çıktı alınması gerektiğinde.
- Basit girdilerin profesyonel iş akışlarına dönüştürülmesi istendiğinde.

## How to use it

Kullanıcıdan gelen kısa girdiyi şu yapısal formüle göre genişletmelisiniz:

1.  **Persona Ataması**: Görev için en uygun uzman kimliğini belirle (Örn: "Kıdemli Yazılım Mimarı", "Yaratıcı Reklam Yazarı").
2.  **Bağlam (Context)**: İsteğin neden yapıldığını ve arka plan bilgilerini ekle.
3.  **Net Görev (Task)**: Yapılacak işi spesifik eylemlerle tanımla.
4.  **Kısıtlamalar ve Stil**: Tonlama, uzunluk, format (JSON, Markdown, Tablo vb.) ve "asla yapılmaması gerekenleri" belirt.
5.  **Örnekleme (Few-Shot)**: Eğer gerekliyse, çıktının kalitesini artıracak bir örnek format ekle.

## Execution Pattern

Kullanıcı bir fikir sunduğunda şu adımları izle:
1.  Girdiyi analiz et ve eksik olan "bağlam" noktalarını belirle.
2.  Geliştirilmiş, kopyalanmaya hazır bir **Final Prompt** oluştur.
3.  Promptun neden bu şekilde yapılandırıldığını açıklayan kısa bir not ekle.

## Example Transformation

**User Input:** "Bana Python öğrenmek için bir plan yap."
**Architect Output:**
> "Bir Python Eğitmeni ve Veri Bilimci olarak hareket et. Hiç yazılım bilmeyen birisi için 4 haftalık, uygulamalı bir öğrenme müfredatı oluştur. Her hafta için 3 ana başlık, 1 pratik proje ve ücretsiz kaynak linkleri ekle. Çıktıyı Markdown tablosu formatında sun."