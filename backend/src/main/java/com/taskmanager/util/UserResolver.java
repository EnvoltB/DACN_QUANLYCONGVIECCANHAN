package com.taskmanager.util;

import com.taskmanager.entity.User;
import com.taskmanager.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
@RequiredArgsConstructor
public class UserResolver {

    private final UserRepository userRepository;

    public Long resolveUserId(HttpServletRequest request) {
        if (request != null) {
            // 1. Check X-User-Email header
            String email = request.getHeader("X-User-Email");
            if (email != null && !email.trim().isEmpty()) {
                Optional<User> byEmail = userRepository.findByEmail(email.trim());
                if (byEmail.isPresent()) {
                    return byEmail.get().getId();
                }
            }

            // 2. Check Authorization header: Bearer jwt_token_<userId>_<timestamp>
            String authHeader = request.getHeader("Authorization");
            if (authHeader != null && authHeader.startsWith("Bearer jwt_token_")) {
                try {
                    String token = authHeader.substring("Bearer jwt_token_".length());
                    String[] parts = token.split("_");
                    Long uid = Long.parseLong(parts[0]);
                    if (userRepository.existsById(uid)) {
                        return uid;
                    }
                } catch (Exception ignored) {}
            }
        }

        // Mặc định fallback về admin@gmail.com nếu không có header
        return userRepository.findByEmail("admin@gmail.com")
                .map(User::getId)
                .orElse(1L);
    }
}
