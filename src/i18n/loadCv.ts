export async function loadCv(language: string = "en") {
  if (language === "en") {
    return import("cv-en.json");
  } else {
    return import("cv-es.json");
  }
}
