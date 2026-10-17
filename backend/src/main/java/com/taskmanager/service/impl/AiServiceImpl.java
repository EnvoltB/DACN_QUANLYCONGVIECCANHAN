package com.taskmanager.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskmanager.client.gemini.GeminiApiClient;
import com.taskmanager.dto.request.AiParseTaskRequest;
import com.taskmanager.dto.response.AiParseTaskResponse;
import com.taskmanager.entity.TimeBlock;
import com.taskmanager.repository.TimeBlockRepository;
import com.taskmanager.service.AiService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
public class AiServiceImpl implements AiService {

    private final GeminiApiClient geminiApiClient;
    private final TimeBlockRepository timeBlockRepository;
    private final ObjectMapper objectMapper;

    public AiServiceImpl(GeminiApiClient geminiApiClient, TimeBlockRepository timeBlockRepository, ObjectMapper objectMapper) {
        this.geminiApiClient = geminiApiClient;
        this.timeBlockRepository = timeBlockRepository;
        this.objectMapper = objectMapper;
    }

    private static final ZoneId VIETNAM_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter ISO_FORMATTER = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    @Override
    public AiParseTaskResponse parseTaskFromNaturalLanguage(AiParseTaskRequest request) {
        String prompt = request.getPrompt() != null ? request.getPrompt().trim() : "";
        Long userId = request.getUserId() != null ? request.getUserId() : 1L;

        // 1. Xác định thời điểm tham chiếu hiện tại
        OffsetDateTime refDateTime = parseReferenceDateTime(request.getCurrentDateTime());

        AiParseTaskResponse response = null;

        // 2. Thử gọi Google Gemini 1.5 Flash nếu client đã cấu hình
        if (geminiApiClient.isConfigured() && !prompt.isBlank()) {
            response = tryGeminiParse(prompt, refDateTime);
        }

        // 3. Fallback Heuristic Parser nếu Gemini chưa cấu hình hoặc gọi API thất bại
        if (response == null) {
            log.info("Sử dụng Heuristic Fallback Parser cho prompt: '{}'", prompt);
            response = fallbackHeuristicParse(prompt, refDateTime);
        }

        // Đảm bảo tiêu đề luôn sạch, không chứa thứ/giờ/ngày tháng thừa
        if (response != null && response.getTitle() != null) {
            response.setTitle(cleanTitle(response.getTitle()));
        }

        // 4. Kiểm tra xung đột thời gian với lịch hiện có trong Database
        checkAndResolveConflicts(response, userId);

        return response;
    }

    /**
     * Gọi Gemini 1.5 Flash bằng WebClient với JSON schema
     */
    private AiParseTaskResponse tryGeminiParse(String prompt, OffsetDateTime refDateTime) {
        try {
            String dayOfWeekName = getVietnameseDayOfWeek(refDateTime.getDayOfWeek());
            String dateStr = refDateTime.format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"));

            String systemInstruction = String.format(
                    "Bạn là trợ lý AI thông minh chuyên về quản lý thời gian và lập lịch công việc cá nhân cho hệ thống SmartTask AI.\n"
                            +
                            "Nhiệm vụ: Phân tích câu lệnh tiếng Việt tự nhiên của người dùng thành một đối tượng công việc chi tiết chuẩn JSON.\n"
                            +
                            "Ngữ cảnh hiện tại của người dùng: Hôm nay là %s, ngày %s (Múi giờ Asia/Ho_Chi_Minh, UTC+07:00).\n"
                            +
                            "\n" +
                            "Quy tắc trích xuất bắt buộc:\n" +
                            "1. title: Tiêu đề công việc ngắn gọn, súc tích. TUYỆT ĐỐI KHÔNG chứa ngày tháng, thứ, giờ hay độ ưu tiên trong tiêu đề (ví dụ: 'học bài 7h to 8h thứ 4' -> title: 'Học bài'; 'họp nhóm chiều mai 15h' -> title: 'Họp nhóm'). Viết hoa chữ cái đầu.\n"
                            +
                            "2. categoryType: Chỉ chọn 1 trong 4 giá trị: 'WORK' (công việc, họp, dự án), 'STUDY' (học bài, đồ án, thi cử, đọc sách), 'HEALTH' (thể thao, gym, uống thuốc, khám bệnh), 'ENTERTAINMENT' (giải trí, xem phim, cà phê, nghỉ ngơi).\n"
                            +
                            "3. Ngày tháng (Date): Nếu người dùng nói thứ (ví dụ: 'thứ 2', 'thứ 4', 'thứ năm', 'chủ nhật'...), hãy tính ngày tương ứng trong tuần hiện tại (hoặc tuần sau nếu có từ 'tuần sau').\n"
                            +
                            "4. startTime: Thời gian bắt đầu định dạng ISO-8601 (YYYY-MM-DDTHH:mm:ss+07:00). Nếu người dùng nói khoảng giờ (ví dụ: '7h to 8h', 'từ 7h đến 8h', '7h - 8h') thì startTime bắt đầu lúc 07:00:00 (hoặc 19:00:00 nếu có từ 'tối').\n"
                            +
                            "5. estimatedDurationMinutes: Thời lượng ước tính (phút). Nếu nói '7h to 8h' -> 60 phút; '7h to 9h' -> 120 phút; '90 phút' -> 90; không nói mặc định 60.\n"
                            +
                            "6. priority: Chỉ 1 trong 4 giá trị: 'URGENT' (gấp, khẩn cấp), 'HIGH' (ưu tiên cao, quan trọng), 'MEDIUM' (bình thường hoặc không nói), 'LOW' (thong thả, ưu tiên thấp).\n"
                            +
                            "7. isFixedTime: true nếu có chỉ định giờ cụ thể, false nếu linh hoạt.\n" +
                            "8. note: Ghi chú ngắn gọn tóm tắt lý do hoặc ngữ cảnh.\n" +
                            "\n" +
                            "BẮT BUỘC trả về duy nhất chuỗi JSON hợp lệ không markdown với các khóa: title, categoryType, startTime, estimatedDurationMinutes, priority, isFixedTime, note.",
                    dayOfWeekName, dateStr);

            Optional<String> geminiResult = geminiApiClient.generateJsonResponse(systemInstruction, prompt);
            if (geminiResult.isPresent()) {
                String jsonText = geminiResult.get().trim();
                // Bỏ bọc ```json nếu có
                if (jsonText.startsWith("```json")) {
                    jsonText = jsonText.substring(7);
                } else if (jsonText.startsWith("```")) {
                    jsonText = jsonText.substring(3);
                }
                if (jsonText.endsWith("```")) {
                    jsonText = jsonText.substring(0, jsonText.length() - 3);
                }
                jsonText = jsonText.trim();

                JsonNode node = objectMapper.readTree(jsonText);
                String title = cleanTitle(node.path("title").asText("Công việc mới"));
                String catType = node.path("categoryType").asText("WORK");
                String startStr = node.path("startTime").asText();
                int duration = node.path("estimatedDurationMinutes").asInt(60);
                String priority = node.path("priority").asText("MEDIUM");
                boolean isFixed = node.path("isFixedTime").asBoolean(true);
                String note = node.path("note").asText("Được phân tích tự động bởi Gemini AI");

                OffsetDateTime startTime = parseIsoDateTimeOrFallback(startStr,
                        refDateTime.plusDays(1).withHour(9).withMinute(0));
                OffsetDateTime endTime = startTime.plusMinutes(duration);

                return AiParseTaskResponse.builder()
                        .title(title)
                        .categoryType(catType)
                        .startTime(startTime.format(ISO_FORMATTER))
                        .endTime(endTime.format(ISO_FORMATTER))
                        .estimatedDurationMinutes(duration)
                        .priority(priority)
                        .isFixedTime(isFixed)
                        .formattedDateLabel(formatDateLabel(startTime, endTime))
                        .note(note)
                        .hasConflict(false)
                        .build();
            }
        } catch (Exception e) {
            log.warn("Gemini parse failed: {}. Sẽ chuyển sang Heuristic.", e.getMessage());
        }
        return null;
    }

    /**
     * Thuật toán Heuristic nội bộ (Rule-based & Regex) khi không có mạng hoặc
     * Gemini key chưa nhập
     */
    private AiParseTaskResponse fallbackHeuristicParse(String prompt, OffsetDateTime refDateTime) {
        String lower = prompt.toLowerCase();

        // 1. Phân loại Category
        String categoryType = "WORK";
        if (lower.contains("học") || lower.contains("hoc")
                || lower.contains("đồ án") || lower.contains("do an")
                || lower.contains("bài tập") || lower.contains("bai tap") || lower.contains("bài") || lower.contains("bai")
                || lower.contains("thi") || lower.contains("ôn") || lower.contains("on")
                || lower.contains("lập trình") || lower.contains("lap trinh")
                || lower.contains("nhập môn") || lower.contains("nhap mon")
                || lower.contains("kỹ thuật") || lower.contains("ky thuat")
                || lower.contains("môn") || lower.contains("mon")
                || lower.contains("sách") || lower.contains("sach")) {
            categoryType = "STUDY";
        } else if (lower.contains("tập") || lower.contains("tap")
                || lower.contains("gym") || lower.contains("chạy bộ") || lower.contains("chay bo")
                || lower.contains("thể dục") || lower.contains("the duc")
                || lower.contains("thuốc") || lower.contains("thuoc") || lower.contains("khám") || lower.contains("kham")) {
            categoryType = "HEALTH";
        } else if (lower.contains("chơi") || lower.contains("choi")
                || lower.contains("phim") || lower.contains("game")
                || lower.contains("cà phê") || lower.contains("ca phe") || lower.contains("cafe")
                || lower.contains("nghỉ") || lower.contains("nghi")) {
            categoryType = "ENTERTAINMENT";
        }

        // 2. Độ ưu tiên
        String priority = "MEDIUM";
        if (lower.contains("khẩn cấp") || lower.contains("gấp")) {
            priority = "URGENT";
        } else if (lower.contains("ưu tiên cao") || lower.contains("quan trọng") || lower.contains("rất quan trọng")) {
            priority = "HIGH";
        } else if (lower.contains("ưu tiên thấp") || lower.contains("thong thả") || lower.contains("khi nào rảnh")) {
            priority = "LOW";
        }

        // 3. Ngày tháng (Date & Day of Week)
        OffsetDateTime targetDate = refDateTime;

        // Bóc tách thứ trong tuần: thứ 2 -> thứ 7, chủ nhật / cn (hỗ trợ cả có dấu và
        // không dấu: thứ/thu)
        Integer targetDayOfWeek = null; // 1 = Monday, ..., 7 = Sunday
        if (Pattern.compile("\\b((?:thứ|thu)\\s*(?:hai|2)|t2)\\b").matcher(lower).find()) {
            targetDayOfWeek = DayOfWeek.MONDAY.getValue();
        } else if (Pattern.compile("\\b((?:thứ|thu)\\s*(?:ba|3)|t3)\\b").matcher(lower).find()) {
            targetDayOfWeek = DayOfWeek.TUESDAY.getValue();
        } else if (Pattern.compile("\\b((?:thứ|thu)\\s*(?:tư|tu|bốn|bon|4)|t4)\\b").matcher(lower).find()) {
            targetDayOfWeek = DayOfWeek.WEDNESDAY.getValue();
        } else if (Pattern.compile("\\b((?:thứ|thu)\\s*(?:năm|nam|5)|t5)\\b").matcher(lower).find()) {
            targetDayOfWeek = DayOfWeek.THURSDAY.getValue();
        } else if (Pattern.compile("\\b((?:thứ|thu)\\s*(?:sáu|sau|6)|t6)\\b").matcher(lower).find()) {
            targetDayOfWeek = DayOfWeek.FRIDAY.getValue();
        } else if (Pattern.compile("\\b((?:thứ|thu)\\s*(?:bảy|bay|7)|t7)\\b").matcher(lower).find()) {
            targetDayOfWeek = DayOfWeek.SATURDAY.getValue();
        } else if (Pattern.compile("\\b((?:chủ|chu)\\s*(?:nhật|nhat)|cn)\\b").matcher(lower).find()) {
            targetDayOfWeek = DayOfWeek.SUNDAY.getValue();
        }

        // 3.1 Bóc tách ngày cụ thể: ngày 17, ngày 17/10, ngày 17 tháng 10
        Pattern exactDatePattern = Pattern.compile("(?:vào\\s*)?ngày\\s*(\\d{1,2})(?:(?:/|\\s*tháng\\s*)(\\d{1,2}))?(?:(?:/|\\s*năm\\s*)(\\d{4}))?");
        Matcher exactDateMatcher = exactDatePattern.matcher(lower);

        if (exactDateMatcher.find()) {
            int d = Integer.parseInt(exactDateMatcher.group(1));
            int m = exactDateMatcher.group(2) != null ? Integer.parseInt(exactDateMatcher.group(2)) : refDateTime.getMonthValue();
            int y = exactDateMatcher.group(3) != null ? Integer.parseInt(exactDateMatcher.group(3)) : refDateTime.getYear();
            try {
                targetDate = targetDate.withYear(y).withMonth(m).withDayOfMonth(d);
            } catch (Exception ignored) {}
        } else if (targetDayOfWeek != null) {
            int currentDow = refDateTime.getDayOfWeek().getValue(); // 1 = Monday, ..., 7 = Sunday
            int dayDiff = targetDayOfWeek - currentDow;
            if (lower.contains("tuần sau")) {
                dayDiff += 7;
            }
            targetDate = refDateTime.plusDays(dayDiff);
        } else if (lower.contains("ngày mai") || lower.contains("chiều mai") || lower.contains("sáng mai")
                || lower.contains("tối mai")) {
            targetDate = refDateTime.plusDays(1);
        } else if (lower.contains("ngày mốt") || lower.contains("hôm kia")) {
            targetDate = refDateTime.plusDays(2);
        } else if (lower.contains("tuần sau")) {
            targetDate = refDateTime.plusDays(7);
        }

        // 4. Giờ giấc & Khoảng thời gian (Start Hour, End Hour, Duration)
        int targetHour = 15;
        int targetMinute = 0;
        int duration = 60;
        boolean hasExplicitHour = false;

        // Ưu tiên 1: Nhận diện khoảng giờ dạng "vào lúc 20 giờ đến 21 giờ", "7h to 8h", "từ 7h đến 8h", "7h - 8h", "20h30 đến 21h30" (hỗ trợ có dấu và không dấu: vao luc, gio, den, toi...)
        Pattern rangePattern = Pattern.compile(
                "(?:(?:từ|tu|vào lúc|vao luc|lúc|luc|vào|vao|tầm|tam|khoảng|khoang)\\s*)?(\\d{1,2})(?:\\s*(?:h|giờ|gio)(?:\\s*(\\d{2}))?|:(\\d{2}))?\\s*(?:to|đến|den|tới|toi|-)\\s*(?:(?:lúc|luc|vào|vao)\\s*)?(\\d{1,2})(?:\\s*(?:h|giờ|gio)(?:\\s*(\\d{2}))?|:(\\d{2}))?");
        Matcher rangeMatcher = rangePattern.matcher(lower);

        if (rangeMatcher.find()) {
            hasExplicitHour = true;
            int startH = Integer.parseInt(rangeMatcher.group(1));
            int startM = 0;
            if (rangeMatcher.group(2) != null) {
                startM = Integer.parseInt(rangeMatcher.group(2));
            } else if (rangeMatcher.group(3) != null) {
                startM = Integer.parseInt(rangeMatcher.group(3));
            }

            int endH = Integer.parseInt(rangeMatcher.group(4));
            int endM = 0;
            if (rangeMatcher.group(5) != null) {
                endM = Integer.parseInt(rangeMatcher.group(5));
            } else if (rangeMatcher.group(6) != null) {
                endM = Integer.parseInt(rangeMatcher.group(6));
            }

            // Xử lý phân biệt sáng / chiều / tối
            if ((lower.contains("tối") || lower.contains("toi") || lower.contains("chiều") || lower.contains("chieu")) && startH < 12) {
                startH += 12;
                if (endH < 12)
                    endH += 12;
            }

            targetHour = startH;
            targetMinute = startM;
            int totalStartMin = startH * 60 + startM;
            int totalEndMin = endH * 60 + endM;
            if (totalEndMin > totalStartMin) {
                duration = totalEndMin - totalStartMin;
            }
        } else {
            // Ưu tiên 2: Bóc tách thời lượng riêng nếu không có range
            Pattern durMinutePattern = Pattern.compile("(?:trong|khoảng|khoang|kéo dài|keo dai|tầm|tam)?\\s*(\\d+)\\s*(phút|phut|p)\\b");
            Matcher durMinuteMatcher = durMinutePattern.matcher(lower);
            if (durMinuteMatcher.find()) {
                duration = Integer.parseInt(durMinuteMatcher.group(1));
            } else if (lower.contains("tiếng rưỡi") || lower.contains("tieng ruoi") || lower.contains("1h30")) {
                duration = 90;
            } else if (lower.contains("nửa tiếng") || lower.contains("nua tieng") || lower.contains("30 phút") || lower.contains("30 phut")) {
                duration = 30;
            } else {
                Pattern durHourPattern = Pattern
                        .compile("(?:trong|khoảng|khoang|kéo dài|keo dai|tầm|tam)\\s*(\\d+)\\s*(?:tiếng|tieng|giờ|gio|h)\\b");
                Matcher durHourMatcher = durHourPattern.matcher(lower);
                if (durHourMatcher.find()) {
                    duration = Integer.parseInt(durHourMatcher.group(1)) * 60;
                } else {
                    Pattern standaloneHourPattern = Pattern.compile("(\\d+)\\s*(?:tiếng|tieng|giờ|gio)\\b");
                    Matcher standaloneHourMatcher = standaloneHourPattern.matcher(lower);
                    if (standaloneHourMatcher.find()) {
                        duration = Integer.parseInt(standaloneHourMatcher.group(1)) * 60;
                    }
                }
            }

            // Bóc tách mốc giờ bắt đầu đơn lẻ: "lúc 15h", "vào 7h", "15h", "vào lúc 20 giờ" (hỗ trợ có dấu và không dấu)
            Pattern hourPattern = Pattern
                    .compile("(?:vào lúc|vao luc|lúc|luc|vào|vao|tầm|tam|khoảng|khoang)?\\s*(\\d{1,2})(?:\\s*(?:h|giờ|gio)(?:\\s*(\\d{2}))?|:(\\d{2})|:00)?(?:\\s*(?:sáng|sang|chiều|chieu|tối|toi))?");
            Matcher hourMatcher = hourPattern.matcher(lower);
            if (hourMatcher.find()) {
                hasExplicitHour = true;
                targetHour = Integer.parseInt(hourMatcher.group(1));
                if ((lower.contains("chiều") || lower.contains("chieu") || lower.contains("tối") || lower.contains("toi")) && targetHour < 12) {
                    targetHour += 12;
                }
            } else if (lower.contains("sáng") || lower.contains("sang")) {
                targetHour = 9;
            } else if (lower.contains("chiều") || lower.contains("chieu")) {
                targetHour = 15;
            } else if (lower.contains("tối") || lower.contains("toi")) {
                targetHour = 19;
            }
        }

        OffsetDateTime startTime = targetDate.withHour(Math.min(targetHour, 23)).withMinute(targetMinute).withSecond(0)
                .withNano(0);
        OffsetDateTime endTime = startTime.plusMinutes(duration);

        // 5. Làm sạch Tiêu đề hoàn toàn (Loại bỏ thứ, dải giờ, thời lượng, mốc giờ khỏi tên task)
        String cleanTitle = cleanTitle(prompt);

        return AiParseTaskResponse.builder()
                .title(cleanTitle)
                .categoryType(categoryType)
                .startTime(startTime.format(ISO_FORMATTER))
                .endTime(endTime.format(ISO_FORMATTER))
                .estimatedDurationMinutes(duration)
                .priority(priority)
                .isFixedTime(hasExplicitHour)
                .formattedDateLabel(formatDateLabel(startTime, endTime))
                .note("Phân tích tự động bởi SmartTask AI")
                .hasConflict(false)
                .build();
    }

    /**
     * Làm sạch hoàn toàn tiêu đề công việc, loại bỏ các tiền tố mệnh lệnh và cụm ngày/giờ/thứ thừa (hỗ trợ cả có dấu và không dấu)
     */
    private String cleanTitle(String text) {
        if (text == null || text.isBlank())
            return "Công việc mới";
        String clean = text;

        // 1. Loại bỏ các tiền tố mệnh lệnh (có dấu và không dấu)
        clean = clean.replaceAll(
                "(?i)^(nhắc tôi|nhac toi|nhắc em|nhac em|nhắc mình|nhac minh|hãy nhớ|hay nho|nhớ|nho|lên lịch|len lich|tạo lịch|tao lich|đặt lịch|dat lich|sắp xếp cho tôi|sap xep cho toi|sắp xếp|sap xep|làm ơn|lam on)\\s*",
                "");

        // 2. Loại bỏ dải giờ (có dấu và không dấu: vào lúc 20 giờ đến 21 giờ, vao luc 20 gio den 21 gio, 7h to 8h...)
        clean = clean.replaceAll(
                "(?i)(?:(?:từ|tu|vào lúc|vao luc|lúc|luc|tầm|tam|khoảng|khoang)\\s*)?\\d{1,2}(?:\\s*(?:h|giờ|gio)(?:\\s*\\d{1,2})?|:\\d{2})?\\s*(?:to|đến|den|tới|toi|-)\\s*(?:(?:lúc|luc|vào|vao)\\s*)?\\d{1,2}(?:\\s*(?:h|giờ|gio)(?:\\s*\\d{1,2})?|:\\d{2})?",
                "");

        // 3. Loại bỏ mốc giờ đơn lẻ (vào lúc 20 giờ, vao luc 20 gio, lúc 7h, luc 7h...)
        clean = clean.replaceAll(
                "(?i)\\b(?:vào lúc|vao luc|lúc|luc|vào|vao|tầm|tam|khoảng|khoang)\\s*\\d{1,2}(?:\\s*(?:h|giờ|gio)(?:\\s*\\d{1,2})?|:\\d{2})?(?:\\s*(?:sáng|sang|chiều|chieu|tối|toi))?\\b",
                "");
        clean = clean.replaceAll("(?i)\\b\\d{1,2}\\s*(?:h|giờ|gio)(?:\\s*\\d{1,2})?\\b", "");

        // 4. Loại bỏ thời lượng (trong 60 phút, 2 tiếng, 1h30...)
        clean = clean.replaceAll("(?i)\\b(?:trong|khoảng|khoang|kéo dài|keo dai|tầm|tam)?\\s*\\d+\\s*(?:phút|phut|p|tiếng|tieng|giờ|gio)\\b", "");
        clean = clean.replaceAll("(?i)\\b(tiếng rưỡi|tieng ruoi|nửa tiếng|nua tieng)\\b", "");

        // 5. Loại bỏ ngày cụ thể & từ chỉ ngày (ngày 17/10, ngay 17/10, ngày 17, ngay 17, ngày, ngay...)
        clean = clean.replaceAll("(?i)\\b(?:vào\\s*|vao\\s*)?(?:ngày|ngay)\\s*\\d{1,2}(?:[/\\-]\\d{1,2})?(?:[/\\-]\\d{4})?\\b", "");
        clean = clean.replaceAll("(?i)\\b(?:vào\\s*|vao\\s*)?(?:ngày|ngay)\\s*\\d{1,2}\\s*(?:tháng|thang)\\s*\\d{1,2}\\b", "");
        clean = clean.replaceAll("(?i)\\b(?:vào\\s*|vao\\s*)?(?:ngày|ngay)\\b", "");

        // 6. Loại bỏ thứ trong tuần (thứ 2 - thứ 7, thu 2 - thu 7, chủ nhật, chu nhat, cn, t2-t7)
        clean = clean.replaceAll(
                "(?i)\\b((?:thứ|thu)\\s*(?:hai|ba|tư|tu|bốn|bon|năm|nam|sáu|sau|bảy|bay|[2-7])|(?:chủ|chu)\\s*(?:nhật|nhat)|cn|t[2-7])\\b",
                "");

        // 7. Loại bỏ từ chỉ mốc thời gian tương đối & buổi (có dấu và không dấu)
        clean = clean.replaceAll(
                "(?i)\\b(hôm nay|hom nay|hôm qua|hom qua|ngày mai|ngay mai|ngày mốt|ngay mot|ngày kia|ngay kia|hôm kia|hom kia|tuần này|tuan nay|tuần sau|tuan sau|tháng này|thang nay|tháng sau|thang sau)\\b",
                "");
        clean = clean.replaceAll(
                "(?i)\\b(sáng nay|sang nay|chiều nay|chieu nay|tối nay|toi nay|sáng mai|sang mai|chiều mai|chieu mai|tối mai|toi mai|sáng|sang|chiều|chieu|tối|toi)\\b",
                "");

        // 8. Loại bỏ độ ưu tiên
        clean = clean.replaceAll("(?i)\\b(ưu tiên|uu tien)\\s*(?:cao|thấp|thap|trung bình|trung binh|khẩn cấp|khan cap)\\b", "");
        clean = clean.replaceAll("(?i)\\b(khẩn cấp|khan cap|quan trọng|quan trong|rất quan trọng|rat quan trong|gấp|gap)\\b", "");

        // 9. Dọn sạch các từ nối còn sót (vào lúc, vao luc, vào, vao, lúc, luc, từ, tu, đến, den, tới, toi...) và dấu câu thừa
        clean = clean.replaceAll("(?i)\\b(vào lúc|vao luc|vào|vao|lúc|luc|từ|tu|đến|den|tới|toi)\\b", "");
        clean = clean.replaceAll("[\\.,;:!\\?~]+$", "").trim();
        clean = clean.replaceAll("^[\\.,;:!\\?~]+", "").trim();
        clean = clean.replaceAll("\\s+", " ").trim();

        if (clean.length() > 1) {
            clean = clean.substring(0, 1).toUpperCase() + clean.substring(1);
        } else if (clean.isEmpty()) {
            clean = "Công việc mới";
        }
        return clean;
    }

    /**
     * Kiểm tra xung đột với các TimeBlock đã có trong DB
     */
    private void checkAndResolveConflicts(AiParseTaskResponse response, Long userId) {
        if (response == null || response.getStartTime() == null)
            return;

        try {
            OffsetDateTime start = OffsetDateTime.parse(response.getStartTime());
            OffsetDateTime end = OffsetDateTime.parse(response.getEndTime());

            // Lấy các timeblocks trong khoảng +- 1 ngày
            OffsetDateTime windowStart = start.minusDays(1);
            OffsetDateTime windowEnd = end.plusDays(1);

            List<TimeBlock> existingBlocks = timeBlockRepository.findByUserIdAndStartTimeBetween(userId, windowStart,
                    windowEnd);

            for (TimeBlock b : existingBlocks) {
                if (b.getStartTime() != null && b.getEndTime() != null) {
                    // Xung đột: StartA < EndB && EndA > StartB
                    if (start.isBefore(b.getEndTime()) && end.isAfter(b.getStartTime())) {
                        response.setHasConflict(true);
                        response.setConflictingTaskTitle(b.getTitle());

                        String bStartStr = b.getStartTime().format(DateTimeFormatter.ofPattern("HH:mm"));
                        String bEndStr = b.getEndTime().format(DateTimeFormatter.ofPattern("HH:mm"));

                        response.setConflictMessage(String.format(
                                "Trùng với %s, %s–%s. Bạn có thể chọn giờ thay thế bên dưới hoặc giữ nguyên.",
                                b.getTitle(), bStartStr, bEndStr));

                        // Gợi ý khung giờ thay thế: ngay sau khi task bị trùng kết thúc
                        OffsetDateTime altStart = b.getEndTime();
                        int dur = response.getEstimatedDurationMinutes() != null
                                ? response.getEstimatedDurationMinutes()
                                : 60;
                        OffsetDateTime altEnd = altStart.plusMinutes(dur);

                        response.setSuggestedAlternativeStartTime(altStart.format(ISO_FORMATTER));
                        response.setSuggestedAlternativeEndTime(altEnd.format(ISO_FORMATTER));
                        break;
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Lỗi kiểm tra xung đột lịch: {}", e.getMessage());
        }
    }

    private OffsetDateTime parseReferenceDateTime(String clientDateTime) {
        if (clientDateTime != null && !clientDateTime.isBlank()) {
            try {
                return OffsetDateTime.parse(clientDateTime);
            } catch (Exception ignored) {
            }
        }
        return OffsetDateTime.now(VIETNAM_ZONE);
    }

    private OffsetDateTime parseIsoDateTimeOrFallback(String str, OffsetDateTime fallback) {
        if (str != null && !str.isBlank()) {
            try {
                return OffsetDateTime.parse(str);
            } catch (Exception ignored) {
            }
        }
        return fallback;
    }

    private String formatDateLabel(OffsetDateTime start, OffsetDateTime end) {
        String dayOfWeek = getVietnameseDayOfWeek(start.getDayOfWeek());
        String date = start.format(DateTimeFormatter.ofPattern("dd/MM"));
        String startH = start.format(DateTimeFormatter.ofPattern("HH:mm"));
        String endH = end.format(DateTimeFormatter.ofPattern("HH:mm"));
        return String.format("%s, %s · %s–%s", dayOfWeek, date, startH, endH);
    }

    private String getVietnameseDayOfWeek(DayOfWeek day) {
        switch (day) {
            case MONDAY:
                return "Thứ Hai";
            case TUESDAY:
                return "Thứ Ba";
            case WEDNESDAY:
                return "Thứ Tư";
            case THURSDAY:
                return "Thứ Năm";
            case FRIDAY:
                return "Thứ Sáu";
            case SATURDAY:
                return "Thứ Bảy";
            case SUNDAY:
                return "Chủ Nhật";
            default:
                return "Hôm nay";
        }
    }
}
