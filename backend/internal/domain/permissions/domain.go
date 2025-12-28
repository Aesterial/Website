package permissions

import (
	"errors"
	"fmt"
)

type Permission uint16

const (
	ViewOtherProfile Permission = iota
	PatchOtherProfile
	PatchSelfProfile
	DeleteSelfProfile
	BanProfile
	UnBanProfile

	CreateIdea
	PatchSelfIdea
	DeleteSelfIdea

	PatchOtherIdea
	DeleteOtherIdea

	CreateComment
	PatchSelfComment
	DeleteSelfComment
	DeleteOtherComment

	UploadIdeaMediaSelf
	DeleteIdeaMediaSelf
	DeleteIdeaMediaOther

	ModerateIdea
	ModerateCommentHide
	ModerateCommentUnhide

	PatchIdeaStatusAdmin

	ViewStatistics

	ViewPermissions
	ManagePermissions
)

type Permissions struct {
	ViewOtherProfile  bool
	PatchOtherProfile bool
	PatchSelfProfile  bool
	DeleteSelfProfile bool
	BanProfile        bool
	UnBanProfile      bool

	CreateIdea     bool
	PatchSelfIdea  bool
	DeleteSelfIdea bool

	PatchOtherIdea  bool
	DeleteOtherIdea bool

	CreateComment      bool
	PatchSelfComment   bool
	DeleteSelfComment  bool
	DeleteOtherComment bool

	UploadIdeaMediaSelf  bool
	DeleteIdeaMediaSelf  bool
	DeleteIdeaMediaOther bool

	ModerateIdea          bool
	ModerateCommentHide   bool
	ModerateCommentUnhide bool

	PatchIdeaStatusAdmin bool

	ViewStatistics bool

	ViewPermissions   bool
	ManagePermissions bool
}

type getter func(Permissions) bool

var Get = map[Permission]getter{
	ViewOtherProfile:      func(p Permissions) bool { return p.ViewOtherProfile },
	PatchOtherProfile:     func(p Permissions) bool { return p.PatchOtherProfile },
	PatchSelfProfile:      func(p Permissions) bool { return p.PatchSelfProfile },
	DeleteSelfProfile:     func(p Permissions) bool { return p.DeleteSelfProfile },
	BanProfile:            func(p Permissions) bool { return p.BanProfile },
	UnBanProfile:          func(p Permissions) bool { return p.UnBanProfile },
	CreateIdea:            func(p Permissions) bool { return p.CreateIdea },
	PatchSelfIdea:         func(p Permissions) bool { return p.PatchSelfIdea },
	DeleteSelfIdea:        func(p Permissions) bool { return p.DeleteSelfIdea },
	PatchOtherIdea:        func(p Permissions) bool { return p.PatchOtherIdea },
	DeleteOtherIdea:       func(p Permissions) bool { return p.DeleteOtherIdea },
	CreateComment:         func(p Permissions) bool { return p.CreateComment },
	PatchSelfComment:      func(p Permissions) bool { return p.PatchSelfComment },
	DeleteSelfComment:     func(p Permissions) bool { return p.DeleteSelfComment },
	DeleteOtherComment:    func(p Permissions) bool { return p.DeleteOtherComment },
	UploadIdeaMediaSelf:   func(p Permissions) bool { return p.UploadIdeaMediaSelf },
	DeleteIdeaMediaSelf:   func(p Permissions) bool { return p.DeleteIdeaMediaSelf },
	DeleteIdeaMediaOther:  func(p Permissions) bool { return p.DeleteIdeaMediaOther },
	ModerateIdea:          func(p Permissions) bool { return p.ModerateIdea },
	ModerateCommentHide:   func(p Permissions) bool { return p.ModerateCommentHide },
	ModerateCommentUnhide: func(p Permissions) bool { return p.ModerateCommentUnhide },
	PatchIdeaStatusAdmin:  func(p Permissions) bool { return p.PatchIdeaStatusAdmin },
	ViewStatistics:        func(p Permissions) bool { return p.ViewStatistics },
	ViewPermissions:       func(p Permissions) bool { return p.ViewPermissions },
	ManagePermissions:     func(p Permissions) bool { return p.ManagePermissions },
}

func (p Permissions) Has(perm Permission) (bool, error) {
	g, ok := Get[perm]
	if !ok {
		return false, fmt.Errorf("%s: %d", "Unknown permission", perm)
	}
	return g(p), nil
}

func (p Permissions) HasBool(perm Permission) bool {
	g, ok := Get[perm]
	if !ok {
		return false
	}
	return g(p)
}

type setter func(*Permissions, bool)

var Setters = map[Permission]setter{
	ViewOtherProfile:      func(p *Permissions, v bool) { p.ViewOtherProfile = v },
	PatchOtherProfile:     func(p *Permissions, v bool) { p.PatchOtherProfile = v },
	PatchSelfProfile:      func(p *Permissions, v bool) { p.PatchSelfProfile = v },
	DeleteSelfProfile:     func(p *Permissions, v bool) { p.DeleteSelfProfile = v },
	BanProfile:            func(p *Permissions, v bool) { p.BanProfile = v },
	UnBanProfile:          func(p *Permissions, v bool) { p.UnBanProfile = v },
	CreateIdea:            func(p *Permissions, v bool) { p.CreateIdea = v },
	PatchSelfIdea:         func(p *Permissions, v bool) { p.PatchSelfIdea = v },
	DeleteSelfIdea:        func(p *Permissions, v bool) { p.DeleteSelfIdea = v },
	PatchOtherIdea:        func(p *Permissions, v bool) { p.PatchOtherIdea = v },
	DeleteOtherIdea:       func(p *Permissions, v bool) { p.DeleteOtherIdea = v },
	CreateComment:         func(p *Permissions, v bool) { p.CreateComment = v },
	PatchSelfComment:      func(p *Permissions, v bool) { p.PatchSelfComment = v },
	DeleteSelfComment:     func(p *Permissions, v bool) { p.DeleteSelfComment = v },
	DeleteOtherComment:    func(p *Permissions, v bool) { p.DeleteOtherComment = v },
	UploadIdeaMediaSelf:   func(p *Permissions, v bool) { p.UploadIdeaMediaSelf = v },
	DeleteIdeaMediaSelf:   func(p *Permissions, v bool) { p.DeleteIdeaMediaSelf = v },
	DeleteIdeaMediaOther:  func(p *Permissions, v bool) { p.DeleteIdeaMediaOther = v },
	ModerateIdea:          func(p *Permissions, v bool) { p.ModerateIdea = v },
	ModerateCommentHide:   func(p *Permissions, v bool) { p.ModerateCommentHide = v },
	ModerateCommentUnhide: func(p *Permissions, v bool) { p.ModerateCommentUnhide = v },
	PatchIdeaStatusAdmin:  func(p *Permissions, v bool) { p.PatchIdeaStatusAdmin = v },
	ViewStatistics:        func(p *Permissions, v bool) { p.ViewStatistics = v },
	ViewPermissions:       func(p *Permissions, v bool) { p.ViewPermissions = v },
	ManagePermissions:     func(p *Permissions, v bool) { p.ManagePermissions = v },
}

func (p *Permissions) Set(perm Permission, state bool) error {
	s, ok := Setters[perm]
	if !ok {
		return errors.New("not found")
	}
	s(p, state)
	return nil
}
