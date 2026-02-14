package types

import (
	"github.com/golang-jwt/jwt/v5"
)

type CookieClaims struct {
	ID string `json:"id"`
	jwt.RegisteredClaims
}

// Testing Type:
// type String string

// func (s String) String() string {
// 	return string(s)
// }

// func (s String) Get() string {
// 	return s.String()
// }

// func (s String) LowerCase() String {
// 	return String(strings.ToLower(s.String()))
// }

// func (s String) UpperCase() String {
// 	return String(strings.ToUpper(s.String()))
// }

// func (s String) Includes(str string) bool {
// 	return strings.Contains(s.String(), str)
// }

// func (s String) Equals(str String) bool {
// 	return strings.EqualFold(s.String(), str.String())
// }

// func (s String) EqualsStr(str string) bool {
// 	return strings.EqualFold(s.String(), str)
// }

// func (s String) Replace(str String, what string, to string) String {
// 	return String(strings.ReplaceAll(s.String(), what, to))
// }
