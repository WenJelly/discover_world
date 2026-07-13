package ipgeo

import (
	"context"
	"database/sql"
	"strings"
	"time"

	"discover_world/internal/common/clientip"
	commonipgeo "discover_world/internal/common/ipgeo"
	"discover_world/internal/svc"
	"discover_world/internal/types"
	"discover_world/model"
)

const (
	TargetTypePost       = "post"
	TargetTypeMediaAsset = "media_asset"

	ActionTypeCreate               = "create"
	ActionTypeUpload               = "upload"
	ActionTypeDirectUploadComplete = "direct_upload_complete"
)

func BuildAttributionRecord(ctx context.Context, resolver commonipgeo.Resolver, hashSecret string, targetType string, targetID uint64, actionType string, userID uint64) (*model.ContentIpAttribution, bool, error) {
	targetType = strings.TrimSpace(targetType)
	actionType = strings.TrimSpace(actionType)
	if targetType == "" || targetID == 0 || actionType == "" || userID == 0 {
		return nil, false, nil
	}

	addr, ok := clientip.FromContext(ctx)
	if !ok {
		return nil, false, nil
	}

	var region commonipgeo.Region
	resolved := false
	if resolver != nil {
		var err error
		region, resolved, err = resolver.Resolve(ctx, addr)
		if err != nil {
			return nil, false, err
		}
	}

	record := &model.ContentIpAttribution{
		TargetType: targetType,
		TargetId:   targetID,
		ActionType: actionType,
		UserId:     userID,
		IpHash:     optionalString(commonipgeo.HashIP(addr, hashSecret)),
		IpVersion: sql.NullInt64{
			Int64: ipVersion(addr),
			Valid: addr.IsValid(),
		},
		Country:         optionalString(region.Country),
		Province:        optionalString(region.Province),
		City:            optionalString(region.City),
		District:        optionalString(region.District),
		Isp:             optionalString(region.ISP),
		DisplayLocation: optionalString(region.DisplayLocation),
		Provider:        optionalString(region.Provider),
		ProviderVersion: optionalString(region.ProviderVersion),
	}
	if resolved {
		record.ResolvedAt = sql.NullTime{Time: time.Now(), Valid: true}
	}
	return record, true, nil
}

func RecordContentAttribution(ctx context.Context, svcCtx *svc.ServiceContext, targetType string, targetID uint64, actionType string, userID uint64) error {
	if svcCtx == nil || !svcCtx.Config.IpGeo.Enabled || svcCtx.ContentIpAttributionModel == nil {
		return nil
	}
	record, ok, err := BuildAttributionRecord(ctx, svcCtx.IpGeoResolver, svcCtx.Config.IpGeo.HashSecret, targetType, targetID, actionType, userID)
	if err != nil || !ok {
		return err
	}
	return svcCtx.ContentIpAttributionModel.Upsert(ctx, record)
}

func LoadRegionsByTarget(ctx context.Context, svcCtx *svc.ServiceContext, targetType string, targetIDs []uint64) (map[uint64]types.IpRegionResponse, error) {
	resp := make(map[uint64]types.IpRegionResponse)
	if svcCtx == nil || svcCtx.ContentIpAttributionModel == nil || len(targetIDs) == 0 {
		return resp, nil
	}
	records, err := svcCtx.ContentIpAttributionModel.FindByTargets(ctx, targetType, targetIDs, ActionTypeCreate)
	if err != nil {
		return nil, err
	}
	if targetType == TargetTypeMediaAsset {
		uploadRecords, err := svcCtx.ContentIpAttributionModel.FindByTargets(ctx, targetType, targetIDs, ActionTypeUpload)
		if err != nil {
			return nil, err
		}
		for id, record := range uploadRecords {
			records[id] = record
		}
		directRecords, err := svcCtx.ContentIpAttributionModel.FindByTargets(ctx, targetType, targetIDs, ActionTypeDirectUploadComplete)
		if err != nil {
			return nil, err
		}
		for id, record := range directRecords {
			records[id] = record
		}
	}
	for id, record := range records {
		region := BuildRegionResponse(record)
		if region.DisplayLocation != "" {
			resp[id] = region
		}
	}
	return resp, nil
}

func BuildRegionResponse(record *model.ContentIpAttribution) types.IpRegionResponse {
	if record == nil {
		return types.IpRegionResponse{}
	}
	country := nullStringValue(record.Country)
	displayLocation := nullStringValue(record.DisplayLocation)
	if strings.EqualFold(country, "reserved") || strings.EqualFold(displayLocation, "reserved") {
		return types.IpRegionResponse{}
	}
	return types.IpRegionResponse{
		Country:         country,
		Province:        nullStringValue(record.Province),
		City:            nullStringValue(record.City),
		District:        nullStringValue(record.District),
		Isp:             nullStringValue(record.Isp),
		DisplayLocation: displayLocation,
		Provider:        nullStringValue(record.Provider),
	}
}

func ipVersion(addr interface{ Is4() bool }) int64 {
	if addr.Is4() {
		return 4
	}
	return 6
}

func optionalString(value string) sql.NullString {
	value = strings.TrimSpace(value)
	if value == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: value, Valid: true}
}

func nullStringValue(value sql.NullString) string {
	if !value.Valid {
		return ""
	}
	return value.String
}
