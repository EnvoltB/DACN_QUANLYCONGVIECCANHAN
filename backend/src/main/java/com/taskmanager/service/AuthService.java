package com.taskmanager.service;

import com.taskmanager.dto.AuthDto;
import com.taskmanager.entity.Role;
import com.taskmanager.entity.User;
import com.taskmanager.repository.RoleRepository;
import com.taskmanager.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Set;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthDto.AuthResponse login(AuthDto.LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail().trim())
                .orElseThrow(() -> new RuntimeException("Email hoặc mật khẩu không chính xác"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new RuntimeException("Email hoặc mật khẩu không chính xác");
        }

        String primaryRole = user.getRoles().stream()
                .anyMatch(r -> "ROLE_ADMIN".equals(r.getName())) ? "Quản trị viên" : "Người dùng";

        String mockJwt = "jwt_token_" + user.getId() + "_" + System.currentTimeMillis();

        return AuthDto.AuthResponse.builder()
                .token(mockJwt)
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(primaryRole)
                .build();
    }

    public AuthDto.AuthResponse register(AuthDto.RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail().trim())) {
            throw new RuntimeException("Email đã được sử dụng");
        }

        Role userRole = roleRepository.findByName("ROLE_USER")
                .orElseGet(() -> roleRepository.save(Role.builder().name("ROLE_USER").description("User").build()));

        User newUser = User.builder()
                .email(request.getEmail().trim())
                .fullName(request.getFullName().trim())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .roles(Set.of(userRole))
                .isActive(true)
                .isEmailVerified(true)
                .build();

        User saved = userRepository.save(newUser);

        return AuthDto.AuthResponse.builder()
                .token("jwt_token_" + saved.getId() + "_" + System.currentTimeMillis())
                .email(saved.getEmail())
                .fullName(saved.getFullName())
                .role("Người dùng")
                .build();
    }
}
